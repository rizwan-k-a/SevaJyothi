/**
 * Lovable Cloud adapter. The only file in the providers layer that talks
 * to `@/integrations/supabase/client` directly. Swap this module out (or
 * pick a different adapter via VITE_BACKEND_PROVIDER) to move off Lovable
 * without touching UI code.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AuthProvider } from "../authProvider";
import type { DatabaseProvider } from "../databaseProvider";
import type { StorageProvider } from "../storageProvider";
import type { RealtimeProvider } from "../realtimeProvider";
import type { NotificationProvider } from "../notificationProvider";
import type { AnalyticsProvider } from "../analyticsProvider";
import type { AuditProvider } from "../auditProvider";
import { clientContext } from "../auditProvider";
import type { SyncProvider } from "../syncProvider";
import type {
  AuditEventType,
  ComplaintRow,
  NotificationRow,
  Role,
  SessionUser,
} from "../types";

/* ------------------------------ auth ------------------------------ */
export const lovableAuth: AuthProvider = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { userId: data.user!.id };
  },
  async signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return { userId: data.user!.id };
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  async currentUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  },
  async rolesFor(userId) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    return (data ?? []).map((r) => r.role as Role);
  },
  onAuthChange(cb) {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      cb(s?.user ? { id: s.user.id, email: s.user.email ?? null } : null);
    });
    return () => sub.subscription.unsubscribe();
  },
};

/* ---------------------------- database ---------------------------- */
export const lovableDatabase: DatabaseProvider = {
  async listComplaints({ limit = 200, forUser, forAssignee } = {}) {
    let q = supabase
      .from("complaints")
      .select("*")
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (forUser) q = q.eq("reporter_id", forUser);
    if (forAssignee) q = q.eq("assigned_to", forAssignee);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as ComplaintRow[];
  },
  async getComplaint(id) {
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as ComplaintRow) ?? null;
  },
  async insertComplaint(row) {
    const { data, error } = await supabase
      .from("complaints")
      .upsert(row as never, { onConflict: "client_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as ComplaintRow;
  },
  async updateComplaint(id, patch) {
    const { error } = await supabase
      .from("complaints")
      .update(patch as never)
      .eq("id", id);
    if (error) throw error;
  },
};

/* ----------------------------- storage ---------------------------- */
export const lovableStorage: StorageProvider = {
  async upload(bucket, path, blob, contentType) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: false });
    if (error) throw error;
    return { path };
  },
  async signedUrl(bucket, path, expiresSeconds = 3600) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresSeconds);
    if (error) throw error;
    return data.signedUrl;
  },
  async remove(bucket, paths) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  },
};

/* ----------------------------- realtime --------------------------- */
export const lovableRealtime: RealtimeProvider = {
  subscribeTable(table, onChange, filter) {
    const ch = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => onChange(payload.eventType, payload.new ?? payload.old),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  },
};

/* --------------------------- notifications ------------------------ */
export const lovableNotifications: NotificationProvider = {
  async list(userId, limit = 30) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as NotificationRow[];
  },
  async markRead(id) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
  async markAllRead(userId) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
  },
  async savePushSubscription(sub, userAgent) {
    const endpoint = sub.endpoint!;
    const keys = sub.keys ?? {};
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint,
        p256dh: keys.p256dh ?? "",
        auth: keys.auth ?? "",
        user_agent: userAgent,
      } as never,
      { onConflict: "endpoint" },
    );
    if (error) throw error;
  },
  async removePushSubscription(endpoint) {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);
    if (error) throw error;
  },
};

/* ----------------------------- analytics -------------------------- */
export const lovableAnalytics: AnalyticsProvider = {
  async stats() {
    const { data, error } = await supabase.rpc("admin_complaint_stats_v3" as never);
    if (error) throw error;
    return data;
  },
  async hotspots(minIncidents = 2) {
    const { data, error } = await supabase.rpc(
      "admin_complaint_hotspots" as never,
      { _min_incidents: minIncidents } as never,
    );
    if (error) throw error;
    return (data ?? []) as never;
  },
};

/* ------------------------------ audit ----------------------------- */
export const lovableAudit: AuditProvider = {
  async log(event: AuditEventType, metadata = {}, complaintId = null) {
    const meta = { ...clientContext(), ...metadata };
    try {
      await supabase.rpc("app_log_event" as never, {
        _event_type: event,
        _metadata: meta as never,
        _complaint_id: complaintId,
      } as never);
    } catch {
      /* audit failures must never break the user flow */
    }
  },
};

/* ------------------------------ sync ------------------------------ */
function base64ToBlob(b64: string, contentType: string): Blob {
  const byteString = atob(b64.split(",").pop()!);
  const arr = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
  return new Blob([arr], { type: contentType });
}

export const lovableSync: SyncProvider = {
  async pushComplaint(p) {
    const inserted = await lovableDatabase.insertComplaint({
      client_id: p.client_id,
      category: p.category,
      description: p.description,
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy,
      village: p.village,
      client_created_at: p.client_created_at,
    });

    if (p.photoBase64 && p.photoContentType) {
      const blob = base64ToBlob(p.photoBase64, p.photoContentType);
      const path = `${inserted.reporter_id}/${inserted.id}.jpg`;
      try {
        await lovableStorage.upload("complaint-media", path, blob, p.photoContentType);
        await lovableDatabase.updateComplaint(inserted.id, {
          // photo_path is part of complaints schema; cast keeps strict types calm
        } as never);
      } catch {
        /* photo upload best-effort; complaint already persisted */
      }
    }

    return { id: inserted.id };
  },
};
