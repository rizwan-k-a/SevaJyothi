/**
 * Demo mode fixtures. Activated by `?demo=true` in the URL.
 * Used for presentation reliability when the network is unavailable.
 * No backend calls, no writes — purely in-memory.
 */
import type { ComplaintCategory } from "@/lib/offline/db";

export type DemoRow = {
  id: string;
  client_id: string;
  category: ComplaintCategory;
  description: string;
  status: "submitted" | "triaged" | "assigned" | "en_route" | "on_site" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "critical";
  priority_score: number;
  created_at: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  village: string | null;
  reporter_id: string;
  assigned_to: string | null;
};

export type DemoEvent = {
  id: string;
  complaint_id: string;
  event: string;
  created_at: string;
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("demo") === "true") {
    try { sessionStorage.setItem("sj-demo", "1"); } catch { /* ignore */ }
    return true;
  }
  try { return sessionStorage.getItem("sj-demo") === "1"; } catch { return false; }
}

export function resetDemoMode(): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem("sj-demo"); } catch { /* ignore */ }
  const url = new URL(window.location.href);
  url.searchParams.delete("demo");
  window.location.replace(url.toString());
}

export const DEMO_COMPLAINTS: DemoRow[] = [
  {
    id: "demo-1", client_id: "demo-1", category: "transformer",
    description: "Transformer near Govt. School exploded at 6:30 PM. Entire lane dark.",
    status: "en_route", priority: "critical", priority_score: 100,
    created_at: hoursAgo(2), lat: 12.9716, lng: 77.5946, accuracy: 18,
    village: "Anekal", reporter_id: "demo-citizen-1", assigned_to: "demo-tech-1",
  },
  {
    id: "demo-2", client_id: "demo-2", category: "network_tower",
    description: "Jio tower down since morning. No signal across 3 villages.",
    status: "assigned", priority: "critical", priority_score: 100,
    created_at: hoursAgo(5), lat: 12.9352, lng: 77.6245, accuracy: 42,
    village: "Sarjapur", reporter_id: "demo-citizen-2", assigned_to: "demo-tech-2",
  },
  {
    id: "demo-3", client_id: "demo-3", category: "water_pipe",
    description: "Main supply line burst behind temple. Road flooded.",
    status: "triaged", priority: "high", priority_score: 80,
    created_at: hoursAgo(7), lat: 13.0067, lng: 77.5630, accuracy: 65,
    village: "Hesaraghatta", reporter_id: "demo-citizen-3", assigned_to: null,
  },
  {
    id: "demo-4", client_id: "demo-4", category: "sewage_leak",
    description: "Manhole overflowing near bus stop. Health hazard.",
    status: "submitted", priority: "high", priority_score: 80,
    created_at: hoursAgo(9), lat: 12.8447, lng: 77.6602, accuracy: 35,
    village: "Bannerghatta", reporter_id: "demo-citizen-4", assigned_to: null,
  },
  {
    id: "demo-5", client_id: "demo-5", category: "road_damage",
    description: "Crater on village link road after monsoon. Bike accident risk.",
    status: "resolved", priority: "normal", priority_score: 50,
    created_at: hoursAgo(36), lat: 13.0827, lng: 77.5877, accuracy: 22,
    village: "Yelahanka", reporter_id: "demo-citizen-5", assigned_to: "demo-tech-1",
  },
  {
    id: "demo-6", client_id: "demo-6", category: "street_light",
    description: "Three lights out on the lane to the school. Children walk in dark.",
    status: "on_site", priority: "low", priority_score: 30,
    created_at: hoursAgo(14), lat: 12.9141, lng: 77.6101, accuracy: 28,
    village: "Begur", reporter_id: "demo-citizen-1", assigned_to: "demo-tech-2",
  },
];

export const DEMO_EVENTS: Record<string, DemoEvent[]> = {
  "demo-1": [
    { id: "e1", complaint_id: "demo-1", event: "reported",       created_at: hoursAgo(2) },
    { id: "e2", complaint_id: "demo-1", event: "synced",         created_at: hoursAgo(2) },
    { id: "e3", complaint_id: "demo-1", event: "status:triaged", created_at: hoursAgo(1.8) },
    { id: "e4", complaint_id: "demo-1", event: "assigned:demo-tech-1", created_at: hoursAgo(1.5) },
    { id: "e5", complaint_id: "demo-1", event: "status:en_route", created_at: hoursAgo(0.5) },
  ],
  "demo-5": [
    { id: "e1", complaint_id: "demo-5", event: "reported",       created_at: hoursAgo(36) },
    { id: "e2", complaint_id: "demo-5", event: "synced",         created_at: hoursAgo(36) },
    { id: "e3", complaint_id: "demo-5", event: "status:triaged", created_at: hoursAgo(34) },
    { id: "e4", complaint_id: "demo-5", event: "assigned:demo-tech-1", created_at: hoursAgo(30) },
    { id: "e5", complaint_id: "demo-5", event: "status:on_site", created_at: hoursAgo(24) },
    { id: "e6", complaint_id: "demo-5", event: "resolved",       created_at: hoursAgo(20) },
  ],
};

export const DEMO_STATS = {
  total: DEMO_COMPLAINTS.length,
  open: DEMO_COMPLAINTS.filter((c) => !["resolved", "closed"].includes(c.status)).length,
  resolved: DEMO_COMPLAINTS.filter((c) => ["resolved", "closed"].includes(c.status)).length,
  critical: DEMO_COMPLAINTS.filter((c) => c.priority === "critical" && !["resolved", "closed"].includes(c.status)).length,
  last24h: DEMO_COMPLAINTS.filter((c) => Date.now() - new Date(c.created_at).getTime() < 86_400_000).length,
  avg_resolution_hours: 16.0,
  active_technicians: 2,
};
