import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/config/supabase";

export type ComplaintCategory =
  | "transformer"
  | "water_pipe"
  | "road_damage"
  | "street_light"
  | "sewage_leak"
  | "network_tower";

export type ComplaintStatus = "pending_sync" | "submitted" | "assigned" | "resolved";

export type StoredComplaint = {
  id: string; // client-side UUID (also stored as `client_id` in cloud)
  remoteId?: string; // cloud row id once synced
  category: ComplaintCategory;
  description: string;
  photoDataUrl?: string;
  photoPath?: string;
  lat?: number;
  lng?: number;
  accuracy?: number; // accuracy_radius in metres
  createdAt: number;
  syncedAt?: number;
  status: ComplaintStatus;
  village?: string;
  syncError?: string;
  // Retry/backoff metadata
  attempt_count?: number;
  last_error?: string;
  next_retry_at?: number; // epoch ms — do not retry before this
};

const DB_NAME = "sevajyothi";
const DB_VERSION = 1;
const STORE = "complaints";

// Exponential backoff schedule (seconds): 1, 2, 5, 10, 30, then 30 thereafter.
export const RETRY_SCHEDULE_SEC = [1, 2, 5, 10, 30];

// Category → priority score (mirrors DB trigger so the UI can show it pre-sync).
export const CATEGORY_PRIORITY_SCORE: Record<ComplaintCategory, number> = {
  transformer: 100,
  network_tower: 100,
  water_pipe: 80,
  sewage_leak: 80,
  road_damage: 50,
  street_light: 30,
};

export function scoreToPriority(score: number): "low" | "normal" | "high" | "critical" {
  if (score >= 100) return "critical";
  if (score >= 80) return "high";
  if (score >= 50) return "normal";
  return "low";
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("status", "status");
          store.createIndex("createdAt", "createdAt");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveComplaint(c: StoredComplaint) {
  const db = await getDb();
  await db.put(STORE, c);
  return c;
}

export async function getAllComplaints(): Promise<StoredComplaint[]> {
  try {
    const db = await getDb();
    const all = await db.getAll(STORE);
    return (all as StoredComplaint[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function getPendingComplaints(): Promise<StoredComplaint[]> {
  try {
    const db = await getDb();
    const idx = db.transaction(STORE).store.index("status");
    const list = (await idx.getAll("pending_sync")) as StoredComplaint[];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

async function update(id: string, patch: Partial<StoredComplaint>) {
  const db = await getDb();
  const item = (await db.get(STORE, id)) as StoredComplaint | undefined;
  if (!item) return;
  await db.put(STORE, { ...item, ...patch });
}

export async function deleteComplaint(id: string) {
  const db = await getDb();
  await db.delete(STORE, id);
}

/* ---------- Cloud bridge ---------- */

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const m = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const bin = atob(m[2]);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
  const ext = mime.split("/")[1]?.split("+")[0] ?? "jpg";
  return { blob: new Blob([buf], { type: mime }), ext };
}

function nextRetryDelayMs(attempt: number): number {
  // attempt = number of failed attempts so far (1-indexed for the next wait)
  const idx = Math.min(attempt - 1, RETRY_SCHEDULE_SEC.length - 1);
  return RETRY_SCHEDULE_SEC[Math.max(0, idx)] * 1000;
}

async function pushOne(c: StoredComplaint): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    let photo_path: string | null = c.photoPath ?? null;
    if (!photo_path && c.photoDataUrl) {
      const f = dataUrlToBlob(c.photoDataUrl);
      if (f) {
        const path = `${user.id}/${c.id}.${f.ext}`;
        const { data: upData, error: upErr } = await supabase.functions.invoke("upload-media", {
          body: {
            path,
            dataUrl: c.photoDataUrl,
            contentType: f.blob.type,
          }
        });
        if (upErr) throw upErr;
        if (upData?.error) throw new Error(upData.error);
        photo_path = path;
      }
    }

    const { data, error } = await supabase
      .from("complaints")
      .upsert(
        {
          client_id: c.id,
          reporter_id: user.id,
          category: c.category,
          description: c.description || "(no description)",
          lat: c.lat ?? null,
          lng: c.lng ?? null,
          accuracy: c.accuracy ?? null,
          photo_path,
          village: c.village ?? null,
        },
        { onConflict: "client_id" },
      )
      .select("id")
      .single();

    if (error) throw error;

    await deleteComplaint(c.id);
    return true;
  } catch (err: any) {
    const attempt = (c.attempt_count ?? 0) + 1;
    const delay = nextRetryDelayMs(attempt);
    const msg = err?.message ?? "Sync failed";
    await update(c.id, {
      attempt_count: attempt,
      last_error: msg,
      next_retry_at: Date.now() + delay,
      syncError: msg,
    });
    return false;
  }
}

export async function flushPendingComplaints(force = false): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const pending = await getPendingComplaints();
  const now = Date.now();
  let n = 0;
  for (const c of pending) {
    // Respect backoff window.
    if (!force && c.next_retry_at && c.next_retry_at > now) continue;
    const ok = await pushOne(c);
    if (ok) n += 1;
  }
  return n;
}
