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

// ---- helpers ----
function genPassword(length = 14): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = lower + upper + digits + symbols;
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  // Guarantee one of each class
  const pick = (set: string, b: number) => set[b % set.length];
  const out = [
    pick(lower, bytes[0]),
    pick(upper, bytes[1]),
    pick(digits, bytes[2]),
    pick(symbols, bytes[3]),
  ];
  for (let i = 4; i < length; i++) out.push(pick(all, bytes[i]));
  // Fisher-Yates shuffle with fresh entropy
  const shuf = new Uint8Array(out.length);
  crypto.getRandomValues(shuf);
  for (let i = out.length - 1; i > 0; i--) {
    const j = shuf[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

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

    // 1. all technician role rows
    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "technician");
    if (roleErr) throw new Error(roleErr.message);
    const ids = (roleRows ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [] as TechnicianRow[];

    // 2. profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, village, phone")
      .in("id", ids);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    // 3. complaint counts
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

    // 4. auth.users (admin API)
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

// ---- create technician ----
const createInput = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  display_name: z.string().trim().min(1).max(100),
  village: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
});

export const createTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAuthority(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const password = genPassword(14);
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: data.display_name },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create technician");
    }
    const userId = created.user.id;

    // handle_new_user trigger has already inserted a 'citizen' role. Replace it.
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "citizen");
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "technician" });
    if (roleErr) throw new Error(roleErr.message);

    // Backfill profile village/phone
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: data.display_name,
          village: data.village ?? null,
          phone: data.phone ?? null,
        },
        { onConflict: "id" },
      );

    return { id: userId, email: data.email, password };
  });

// ---- reset password ----
const resetInput = z.object({ user_id: z.string().uuid() });
export const resetTechnicianPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resetInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAuthority(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirm target is a technician
    const { data: rr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .eq("role", "technician")
      .maybeSingle();
    if (!rr) throw new Error("Target user is not a technician");

    const password = genPassword(14);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password,
    });
    if (error) throw new Error(error.message);
    return { user_id: data.user_id, password };
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
      ban_duration: data.disable ? "876000h" : "none", // 100 years effectively disables
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
    // Confirm technician
    const { data: rr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .eq("role", "technician")
      .maybeSingle();
    if (!rr) throw new Error("Target user is not a technician");

    // Unassign any open complaints first to avoid orphan job rows under tight RLS views
    await supabaseAdmin
      .from("complaints")
      .update({ assigned_to: null })
      .eq("assigned_to", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
