import { supabase } from "../config/supabase";

export const supabaseAuth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { userId: data.user.id };
  },
  async signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return { userId: data.user.id };
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
    return (data ?? []).map((r) => r.role);
  },
  onAuthChange(cb) {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      cb(s?.user ? { id: s.user.id, email: s.user.email ?? null } : null);
    });
    return () => sub.subscription.unsubscribe();
  },
};

export const supabaseDatabase = {
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
    return data ?? [];
  },
  async getComplaint(id) {
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
  async insertComplaint(row) {
    const { data, error } = await supabase
      .from("complaints")
      .upsert(row, { onConflict: "client_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
  async updateComplaint(id, patch) {
    const { error } = await supabase
      .from("complaints")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  },
};

export const supabaseStorage = {
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

export const supabaseRealtime = {
  subscribeTable(table, onChange, filter) {
    const ch = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
        },
        (payload) => onChange(payload.eventType, payload.new ?? payload.old)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  },
};

export const supabaseNotifications = {
  async list(userId, limit = 30) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
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
    const endpoint = sub.endpoint;
    const keys = sub.keys ?? {};
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint,
        p256dh: keys.p256dh ?? "",
        auth: keys.auth ?? "",
        user_agent: userAgent,
      },
      { onConflict: "endpoint" }
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
