import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.heat";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  priority: "low" | "normal" | "high" | "critical";
  label: string;
  category: string;
  /** Optional GPS accuracy in metres — shown as a radius circle */
  accuracy?: number;
};

const COLOR: Record<MapPoint["priority"], string> = {
  critical: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#94a3b8",
};

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

// CartoDB light basemap (Positron) — clean, premium look
const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
const TILE_LABELS = "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";

function pinIcon(p: MapPoint) {
  const color = COLOR[p.priority];
  const pulse = p.priority === "critical" || p.priority === "high";
  const size = p.priority === "critical" ? 22 : 18;
  const html = `
    <div class="sj-pin" style="--c:${color};width:${size}px;height:${size}px">
      ${pulse ? '<span class="sj-pin-ring"></span>' : ""}
      <span class="sj-pin-dot"></span>
    </div>`;
  return L.divIcon({
    html,
    className: "sj-pin-wrap",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 44 : count < 50 ? 54 : 64;
  const html = `<div class="sj-cluster" style="width:${size}px;height:${size}px">
    <span class="sj-cluster-ring"></span>
    <span class="sj-cluster-text">${count}</span>
  </div>`;
  return L.divIcon({ html, className: "sj-cluster-wrap", iconSize: [size, size] });
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Build a platform-aware navigation deep-link. */
function buildNavUrl(lat: number, lng: number): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPad|iPhone|iPod/.test(ua)) return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/** Haversine distance in km */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371,
    toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]),
    dLng = toRad(b[1] - a[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function ComplaintMap({
  points = [],
  height = 360,
  onSelect,
  selectedId,
  routeFromUser,
  single,
  heatmap = false,
  hotspots,
  /** Citizen pin-correction: when true the single marker is draggable and emits updated coords */
  draggable = false,
  onPinMoved,
}: {
  points: MapPoint[];
  height?: number;
  onSelect?: (id: string) => void;
  selectedId?: string;
  routeFromUser?: boolean;
  single?: boolean;
  /** overlay a density heatmap derived from `points`. */
  heatmap?: boolean;
  /** server-computed recurring failure hotspots; rendered as outlined zones. */
  hotspots?: Array<{ lat: number; lng: number; incidents: number; total_priority: number }>;
  /** Allow citizen to drag pin to correct GPS location */
  draggable?: boolean;
  onPinMoved?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const hotspotLayerRef = useRef<L.LayerGroup | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const markersRef = useRef<Map<string, L.Marker & { _sjPriority?: MapPoint["priority"] }>>(
    new Map(),
  );
  const didInitialFit = useRef(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [tracking, setTracking] = useState(false);
  /** ETA in minutes from userPos to selectedId point */
  const [etaMin, setEtaMin] = useState<number | null>(null);
  /** The nearest point to the user (for technician view) */
  const [nearestId, setNearestId] = useState<string | null>(null);

  // 1x1 transparent PNG — graceful fallback when a tile fails (offline / blocked)
  const TILE_FALLBACK =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: single ? 14 : 8,
      preferCanvas: true,
      attributionControl: false,
      zoomControl: !single,
      scrollWheelZoom: !single,
      zoomAnimation: true,
      fadeAnimation: false,
      wheelDebounceTime: 80,
      // On mobile, allow the page to scroll when touch starts outside a marker
      dragging: true,
      tap: false,
    });
    const tileOpts = {
      maxZoom: 19,
      subdomains: "abcd" as unknown as string[],
      detectRetina: false,
      crossOrigin: true as const,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
      errorTileUrl: TILE_FALLBACK,
    };
    L.tileLayer(TILE_LIGHT, { ...tileOpts, attribution: "© OSM · © CARTO" }).addTo(map);
    // Lower opacity on labels to let incident markers become the primary focus
    L.tileLayer(TILE_LABELS, { ...tileOpts, pane: "shadowPane", opacity: 0.5 }).addTo(map);
    L.control
      .attribution({ prefix: false, position: "bottomleft" })
      .addAttribution("© OSM · CARTO")
      .addTo(map);

    if (!single) {
      const cluster = (
        L as unknown as { markerClusterGroup: (opts: object) => L.MarkerClusterGroup }
      ).markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 55,
        iconCreateFunction: clusterIcon,
      });
      map.addLayer(cluster);
      clusterRef.current = cluster;
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      routeRef.current = null;
      userMarkerRef.current = null;
      accuracyRef.current = null;
      markersRef.current.clear();
      didInitialFit.current = false;
    };
  }, [single]);

  // render points — diff against existing markers (no full clear on realtime push)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    if (single) {
      map.eachLayer((l) => {
        if (l instanceof L.Marker || l instanceof L.CircleMarker || l instanceof L.Circle)
          map.removeLayer(l);
      });
      if (accuracyRef.current) {
        map.removeLayer(accuracyRef.current);
        accuracyRef.current = null;
      }
      if (valid.length === 0) return;
      const p = valid[0];

      // GPS accuracy radius circle
      if (p.accuracy && p.accuracy > 0) {
        const acc = L.circle([p.lat, p.lng], {
          radius: p.accuracy,
          color: COLOR[p.priority],
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0.07,
          dashArray: "4 3",
        }).addTo(map);
        accuracyRef.current = acc;
      }

      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p), draggable }).addTo(map);
      m.bindPopup(`<b>${escapeHtml(p.category)}</b><br/>${escapeHtml(p.label)}`);

      // Draggable pin for citizen GPS correction
      if (draggable && onPinMoved) {
        m.on("dragend", () => {
          const ll = m.getLatLng();
          if (accuracyRef.current) {
            accuracyRef.current.setLatLng(ll);
          }
          onPinMoved(ll.lat, ll.lng);
        });
        // Show hint tooltip on drag start
        m.bindTooltip("Drag to correct location", {
          permanent: false,
          direction: "top",
          offset: [0, -12],
        });
      }

      map.setView([p.lat, p.lng], 15);
      return;
    }

    const cluster = clusterRef.current;
    if (!cluster) return;

    const next = new Map(valid.map((p) => [p.id, p]));
    const existing = markersRef.current;
    const toRemove: L.Marker[] = [];
    const toAdd: L.Marker[] = [];

    // Compute nearest to user
    if (userPos) {
      let minDist = Infinity,
        minId: string | null = null;
      for (const p of valid) {
        const d = haversineKm(userPos, [p.lat, p.lng]);
        if (d < minDist) {
          minDist = d;
          minId = p.id;
        }
      }
      setNearestId(minId);
    }

    // remove or update
    for (const [id, marker] of existing) {
      const p = next.get(id);
      if (!p) {
        toRemove.push(marker);
        existing.delete(id);
        continue;
      }
      if (marker._sjPriority !== p.priority) {
        marker.setIcon(pinIcon(p));
        marker._sjPriority = p.priority;
      }
      const ll = marker.getLatLng();
      if (ll.lat !== p.lat || ll.lng !== p.lng) marker.setLatLng([p.lat, p.lng]);
    }
    // add new
    const bounds = L.latLngBounds([]);
    for (const p of valid) {
      bounds.extend([p.lat, p.lng]);
      if (existing.has(p.id)) continue;
      const marker = L.marker([p.lat, p.lng], { icon: pinIcon(p) }) as L.Marker & {
        _sjPriority?: MapPoint["priority"];
      };
      marker._sjPriority = p.priority;
      const isNearest = p.id === nearestId;
      const navUrl = buildNavUrl(p.lat, p.lng);
      marker.bindTooltip(
        `<div style="font-size:11px;line-height:1.4">
          <b>${escapeHtml(p.category)}</b> · <span style="color:${COLOR[p.priority]}">${p.priority}</span>
          ${isNearest ? '<br/><span style="color:#22d3ee">◉ Nearest to you</span>' : ""}
          <br/>${escapeHtml(p.label)}
          <br/><a href="${navUrl}" target="_blank" style="color:#60a5fa;text-decoration:underline">▷ Navigate</a>
        </div>`,
        { direction: "top", offset: [0, -8] },
      );
      if (onSelect) marker.on("click", () => onSelect(p.id));
      existing.set(p.id, marker);
      toAdd.push(marker);
    }
    if (toRemove.length) cluster.removeLayers(toRemove);
    if (toAdd.length) cluster.addLayers(toAdd);

    // Only fit bounds on first non-empty render
    if (!didInitialFit.current && bounds.isValid() && !selectedId) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
      didInitialFit.current = true;
    }
  }, [points, onSelect, single, selectedId, draggable, onPinMoved, userPos, nearestId]);

  // heatmap density overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || single) return;
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }
    if (!heatmap) return;
    const weights = points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => {
        const w =
          p.priority === "critical"
            ? 1
            : p.priority === "high"
              ? 0.75
              : p.priority === "normal"
                ? 0.5
                : 0.25;
        return [p.lat, p.lng, w] as [number, number, number];
      });
    if (!weights.length) return;
    const layer = (
      L as unknown as { heatLayer: (pts: unknown[], opts: object) => L.Layer }
    ).heatLayer(weights, {
      radius: 28,
      blur: 22,
      maxZoom: 14,
      minOpacity: 0.35,
      gradient: { 0.2: "#6BCBFF", 0.5: "#3F8CFF", 0.8: "#FFB84D", 1.0: "#FF5E6C" },
    });
    layer.addTo(map);
    heatRef.current = layer;
  }, [heatmap, points, single]);

  // server-computed recurring hotspots (vulnerability zones)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || single) return;
    if (hotspotLayerRef.current) {
      map.removeLayer(hotspotLayerRef.current);
      hotspotLayerRef.current = null;
    }
    if (!hotspots || !hotspots.length) return;
    const group = L.layerGroup();
    const maxScore = Math.max(...hotspots.map((h) => h.total_priority), 1);
    for (const h of hotspots) {
      const intensity = h.total_priority / maxScore;
      const radius = 220 + intensity * 480;
      L.circle([h.lat, h.lng], {
        radius,
        color: intensity > 0.66 ? "#ef4444" : intensity > 0.33 ? "#f97316" : "#fbbf24",
        weight: 1.2,
        opacity: 0.7,
        fillOpacity: 0.08,
        dashArray: "4 4",
      })
        .bindTooltip(
          `<div style="font-size:11px"><b>Recurring zone</b><br/>${h.incidents} incidents · score ${h.total_priority}</div>`,
          { direction: "top" },
        )
        .addTo(group);
    }
    group.addTo(map);
    hotspotLayerRef.current = group;
  }, [hotspots, single]);

  // pan to selected + compute ETA
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const p = points.find((x) => x.id === selectedId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    if (userPos) {
      const dist = haversineKm(userPos, [p.lat, p.lng]);
      // Rural India driving avg ~30 km/h
      setEtaMin(Math.max(1, Math.round((dist / 30) * 60)));
    }
  }, [selectedId, points, userPos]);

  // route preview from user
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    if (!routeFromUser || !selectedId || !userPos) return;
    const p = points.find((x) => x.id === selectedId);
    if (!p) return;
    const line = L.polyline([userPos, [p.lat, p.lng]], {
      color: "#22d3ee",
      weight: 3,
      opacity: 0.85,
      dashArray: "6 8",
    }).addTo(map);
    routeRef.current = line;
    map.fitBounds(line.getBounds().pad(0.3));
  }, [routeFromUser, selectedId, userPos, points]);

  // user position tracking
  useEffect(() => {
    if (!routeFromUser || !("geolocation" in navigator)) return;
    setTracking(true);
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(c);
        const map = mapRef.current;
        if (!map) return;
        if (!userMarkerRef.current) {
          userMarkerRef.current = L.circleMarker(c, {
            radius: 7,
            color: "#22d3ee",
            weight: 2,
            fillColor: "#22d3ee",
            fillOpacity: 0.9,
          })
            .addTo(map)
            .bindTooltip("You");
        } else {
          userMarkerRef.current.setLatLng(c);
        }
      },
      () => setTracking(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => {
      navigator.geolocation.clearWatch(watch);
      setTracking(false);
    };
  }, [routeFromUser]);

  // Compute nearest technician location from user
  useEffect(() => {
    if (!userPos || single) return;
    let minDist = Infinity,
      minId: string | null = null;
    for (const p of points) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      const d = haversineKm(userPos, [p.lat, p.lng]);
      if (d < minDist) {
        minDist = d;
        minId = p.id;
      }
    }
    setNearestId(minId);
  }, [userPos, points, single]);

  const selectedPoint = selectedId ? points.find((p) => p.id === selectedId) : null;
  const navUrl = selectedPoint ? buildNavUrl(selectedPoint.lat, selectedPoint.lng) : null;

  return (
    <div className="relative" style={{ height, width: "100%" }}>
      <div
        ref={containerRef}
        style={{
          height,
          width: "100%",
          borderRadius: 28,
          overflow: "hidden",
          background: "#FCFDFF",
        }}
        aria-label="Operational complaint map"
      />

      {/* Priority legend — multi-pin view */}
      {!single && (
        <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-col gap-1 rounded-lg bg-black/55 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/90 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: COLOR.critical, boxShadow: `0 0 8px ${COLOR.critical}` }}
            />
            Critical
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR.high }} />
            High
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR.normal }} />
            Normal
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR.low }} />
            Low
          </div>
        </div>
      )}



      {/* Draggable pin hint */}
      {single && draggable && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
          Drag pin to correct location
        </div>
      )}

      {/* Navigate + ETA button — shown when a point is selected and user has GPS */}
      {navUrl && selectedPoint && (
        <a
          href={navUrl}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto absolute bottom-3 right-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-cyan-400/90 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg backdrop-blur hover:bg-cyan-300"
        >
          ▷ Navigate
          {etaMin && (
            <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5">~{etaMin}m</span>
          )}
        </a>
      )}
    </div>
  );
}
