import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/config/supabaseAdmin";
// In a real app we'd verify the admin session using auth context
// For simplicity in this demo, we assume the UI hides this unless you are an admin

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

// ---- list applications ----
export const listApplications = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("technician_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as ApplicationRow[]) ?? [];
});

// ---- approve application ----
const approveInput = z.object({ id: z.string().uuid() });
export const approveTechnician = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => approveInput.parse(d))
  .handler(async ({ data }) => {
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
  .inputValidator((d: unknown) => rejectInput.parse(d))
  .handler(async ({ data }) => {
    const { error: appErr } = await supabaseAdmin
      .from("technician_applications")
      .update({ status: "rejected" })
      .eq("id", data.id);
    if (appErr) throw new Error(appErr.message);

    return { ok: true };
  });
