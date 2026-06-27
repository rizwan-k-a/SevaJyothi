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
};

const COLOR: Record<MapPoint["priority"], string> = {
  critical: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#94a3b8",
};

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

// CartoDB dark basemap — operations-center look, light bandwidth (raster, ~15-30KB/tile)
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const TILE_LABELS = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";

function pinIcon(p: MapPoint) {
  const color = COLOR[p.priority];
  const pulse = p.priority === "critical" || p.priority === "high";
  const size = p.priority === "critical" ? 22 : 18;
  const html = `
    <div class="sj-pin" style="--c:${color};width:${size}px;height:${size}px">
      ${pulse ? '<span class="sj-pin-ring"></span>' : ""}
      <span class="sj-pin-dot"></span>
    </div>`;
  return L.divIcon({ html, className: "sj-pin-wrap", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function clusterIcon(cluster: L.MarkerCluster) {
  const markers = cluster.getAllChildMarkers() as Array<L.Marker & { _sjPriority?: MapPoint["priority"] }>;
  const score = markers.reduce((s, m) => {
    const p = m._sjPriority ?? "normal";
    return s + (p === "critical" ? 100 : p === "high" ? 60 : p === "normal" ? 20 : 5);
  }, 0);
  const dominant: MapPoint["priority"] =
    score / markers.length >= 70 ? "critical" : score / markers.length >= 40 ? "high" : "normal";
  const color = COLOR[dominant];
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 50 ? 44 : 54;
  const html = `<div class="sj-cluster" style="--c:${color};width:${size}px;height:${size}px"><span>${count}</span></div>`;
  return L.divIcon({ html, className: "sj-cluster-wrap", iconSize: [size, size] });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function ComplaintMap({
  points,
  height = 360,
  onSelect,
  selectedId,
  routeFromUser,
  single,
  heatmap = false,
  hotspots,
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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const hotspotLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker & { _sjPriority?: MapPoint["priority"] }>>(new Map());
  const didInitialFit = useRef(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [tracking, setTracking] = useState(false);

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
      // low-bandwidth: avoid mid-zoom tile thrash
      zoomAnimation: true,
      fadeAnimation: false,
      wheelDebounceTime: 80,
    });
    const tileOpts = {
      maxZoom: 19,
      subdomains: "abcd" as unknown as string[],
      detectRetina: false, // skip @2x fetches to halve bytes on hi-dpi
      crossOrigin: true as const,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1, // only ring of tiles around viewport
      errorTileUrl: TILE_FALLBACK,
    };
    L.tileLayer(TILE_DARK, { ...tileOpts, attribution: "© OSM · © CARTO" }).addTo(map);
    L.tileLayer(TILE_LABELS, { ...tileOpts, pane: "shadowPane", opacity: 0.85 }).addTo(map);
    L.control.attribution({ prefix: false, position: "bottomleft" }).addAttribution("© OSM · CARTO").addTo(map);

    if (!single) {
      const cluster = (L as unknown as { markerClusterGroup: (opts: object) => L.MarkerClusterGroup }).markerClusterGroup({
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
        if (l instanceof L.Marker || l instanceof L.CircleMarker) map.removeLayer(l);
      });
      if (valid.length === 0) return;
      const p = valid[0];
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p) }).addTo(map);
      m.bindPopup(`<b>${escapeHtml(p.category)}</b><br/>${escapeHtml(p.label)}`);
      L.circle([p.lat, p.lng], { radius: 80, color: COLOR[p.priority], weight: 1, fillOpacity: 0.08 }).addTo(map);
      map.setView([p.lat, p.lng], 15);
      return;
    }

    const cluster = clusterRef.current;
    if (!cluster) return;

    const next = new Map(valid.map((p) => [p.id, p]));
    const existing = markersRef.current;
    const toRemove: L.Marker[] = [];
    const toAdd: L.Marker[] = [];

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
      const marker = L.marker([p.lat, p.lng], { icon: pinIcon(p) }) as L.Marker & { _sjPriority?: MapPoint["priority"] };
      marker._sjPriority = p.priority;
      marker.bindTooltip(
        `<div style="font-size:11px;line-height:1.3"><b>${escapeHtml(p.category)}</b> · <span style="color:${COLOR[p.priority]}">${p.priority}</span><br/>${escapeHtml(p.label)}</div>`,
        { direction: "top", offset: [0, -8] },
      );
      if (onSelect) marker.on("click", () => onSelect(p.id));
      existing.set(p.id, marker);
      toAdd.push(marker);
    }
    if (toRemove.length) cluster.removeLayers(toRemove);
    if (toAdd.length) cluster.addLayers(toAdd);

    // Only fit bounds on first non-empty render — avoids zoom jumps on realtime push
    if (!didInitialFit.current && bounds.isValid() && !selectedId) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
      didInitialFit.current = true;
    }
  }, [points, onSelect, single, selectedId]);

  // heatmap density overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || single) return;
    if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
    if (!heatmap) return;
    const weights = points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => {
        const w = p.priority === "critical" ? 1 : p.priority === "high" ? 0.75 : p.priority === "normal" ? 0.5 : 0.25;
        return [p.lat, p.lng, w] as [number, number, number];
      });
    if (!weights.length) return;
    const layer = (L as unknown as { heatLayer: (pts: unknown[], opts: object) => L.Layer }).heatLayer(weights, {
      radius: 28, blur: 22, maxZoom: 14, minOpacity: 0.35,
      gradient: { 0.2: "#3b82f6", 0.5: "#f59e0b", 0.8: "#f97316", 1.0: "#ef4444" },
    });
    layer.addTo(map);
    heatRef.current = layer;
  }, [heatmap, points, single]);

  // server-computed recurring hotspots (vulnerability zones)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || single) return;
    if (hotspotLayerRef.current) { map.removeLayer(hotspotLayerRef.current); hotspotLayerRef.current = null; }
    if (!hotspots || !hotspots.length) return;
    const group = L.layerGroup();
    const maxScore = Math.max(...hotspots.map((h) => h.total_priority), 1);
    for (const h of hotspots) {
      const intensity = h.total_priority / maxScore;
      const radius = 220 + intensity * 480; // 220-700m
      L.circle([h.lat, h.lng], {
        radius,
        color: intensity > 0.66 ? "#ef4444" : intensity > 0.33 ? "#f97316" : "#fbbf24",
        weight: 1.2, opacity: 0.7, fillOpacity: 0.08, dashArray: "4 4",
      }).bindTooltip(
        `<div style="font-size:11px"><b>Recurring zone</b><br/>${h.incidents} incidents · score ${h.total_priority}</div>`,
        { direction: "top" },
      ).addTo(group);
    }
    group.addTo(map);
    hotspotLayerRef.current = group;
  }, [hotspots, single]);

  // pan to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const p = points.find((x) => x.id === selectedId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [selectedId, points]);

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
            radius: 7, color: "#22d3ee", weight: 2, fillColor: "#22d3ee", fillOpacity: 0.9,
          }).addTo(map).bindTooltip("You");
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

  return (
    <div className="relative" style={{ height, width: "100%" }}>
      <div
        ref={containerRef}
        style={{ height, width: "100%", borderRadius: 16, overflow: "hidden", background: "#0a0f1a" }}
        aria-label="Operational complaint map"
      />
      {!single && (
        <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-col gap-1 rounded-lg bg-black/55 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/90 backdrop-blur">
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLOR.critical, boxShadow: `0 0 8px ${COLOR.critical}` }} />Critical</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLOR.high }} />High</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLOR.normal }} />Normal</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLOR.low }} />Low</div>
        </div>
      )}
      {!single && (
        <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-lg bg-black/55 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/90 backdrop-blur">
          {points.length} incidents {routeFromUser && tracking ? "· GPS live" : ""}
        </div>
      )}
    </div>
  );
}
