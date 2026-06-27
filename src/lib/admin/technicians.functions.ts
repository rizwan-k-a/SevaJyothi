import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- shared types ----
export type TechnicianRow = {
  id: string;
  email: string;
  display_name: string | null;
  village: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  open_jobs: number;
  resolved_jobs: number;
};

export type ApplicationRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  region: string | null;
  technical_skill: string | null;
  vehicle_available: boolean;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type CitizenRow = {
  id: string;
  email: string;
  display_name: string | null;
  village: string | null;
  phone: string | null;
  created_at: string;
};

async function assertAuthority(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "authority")
    .maybeSingle();
  if (error) throw new Error("Authorization check failed");
  if (!data) throw new Error("Forbidden: authority role required");
}

// ---- list technicians ----
export const listTechnicians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAuthority(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "technician");
    if (roleErr) throw new Error(roleErr.message);
    const ids = (roleRows ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [] as TechnicianRow[];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, village, phone")
      .in("id", ids);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const { data: complaints } = await supabaseAdmin
      .from("complaints")
      .select("assigned_to, status")
      .in("assigned_to", ids);
    const openCount = new Map<string, number>();
    const resolvedCount = new Map<string, number>();
    for (const c of complaints ?? []) {
      const k = c.assigned_to as string;
      if (c.status === "resolved" || c.status === "closed") {
        resolvedCount.set(k, (resolvedCount.get(k) ?? 0) + 1);
      } else {
        openCount.set(k, (openCount.get(k) ?? 0) + 1);
      }
    }

    const rows: TechnicianRow[] = [];
    for (const id of ids) {
      const { data: ures } = await supabaseAdmin.auth.admin.getUserById(id);
      const u = ures?.user;
      const p = profileById.get(id);
      rows.push({
        id,
        email: u?.email ?? "(unknown)",
        display_name: p?.display_name ?? null,
        village: p?.village ?? null,
        phone: p?.phone ?? null,
        created_at: u?.created_at ?? new Date(0).toISOString(),
        last_sign_in_at: u?.last_sign_in_at ?? null,
        banned_until: (u as any)?.banned_until ?? null,
        open_jobs: openCount.get(id) ?? 0,
        resolved_jobs: resolvedCount.get(id) ?? 0,
      });
    }
    rows.sort((a, b) => (a.email > b.email ? 1 : -1));
    return rows;
  });

// ---- list applications ----
export const listTechnicianApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAuthority(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("technician_applications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as ApplicationRow[];
  });

// ---- approve application ----
const approveInput = z.object({ id: z.string().uuid() });
export const approveTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => approveInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAuthority(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Call the RPC to insert the user into auth.users and mark approved
    const { error: appErr } = await supabaseAdmin.rpc("approve_technician_application", {
      _application_id: data.id,
    });
    if (appErr) throw new Error(appErr.message);

    return { ok: true };
  });

// ---- reject application ----
const rejectInput = z.object({ id: z.string().uuid() });
export const rejectTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rejectInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAuthority(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: appErr } = await supabaseAdmin
      .from("technician_applications")
      .update({ status: "rejected" })
      .eq("id", data.id);
    if (appErr) throw new Error(appErr.message);

    // Optionally ban or delete the auth user? We just leave them stranded or they can sign up as citizen later
    return { ok: true };
  });

// ---- list citizens ----
export const listCitizens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAuthority(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "citizen");
    if (roleErr) throw new Error(roleErr.message);
    const ids = (roleRows ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [] as CitizenRow[];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, village, phone")
      .in("id", ids);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const rows: CitizenRow[] = [];
    for (const id of ids) {
      const { data: ures } = await supabaseAdmin.auth.admin.getUserById(id);
      const u = ures?.user;
      const p = profileById.get(id);
      rows.push({
        id,
        email: u?.email ?? "(unknown)",
        display_name: p?.display_name ?? null,
        village: p?.village ?? null,
        phone: p?.phone ?? null,
        created_at: u?.created_at ?? new Date(0).toISOString(),
      });
    }
    rows.sort((a, b) => (a.email > b.email ? 1 : -1));
    return rows;
  });

// ---- toggle ban / activate ----
const banInput = z.object({ user_id: z.string().uuid(), disable: z.boolean() });
export const setTechnicianBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => banInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAuthority(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disable ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- delete technician ----
const delInput = z.object({ user_id: z.string().uuid() });
export const deleteTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => delInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAuthority(context);
    if (data.user_id === context.userId) {
      throw new Error("You cannot delete your own account");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Unassign open complaints
    await supabaseAdmin
      .from("complaints")
      .update({ assigned_to: null })
      .eq("assigned_to", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
