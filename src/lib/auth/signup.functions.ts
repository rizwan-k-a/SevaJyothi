import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/config/supabaseAdmin";

const citizenSignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string(),
  phone: z.string().optional(),
  region: z.string().optional(),
});

export const citizenSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => citizenSignupInput.parse(d))
  .handler(async ({ data }) => {
    // Bypass client-side GoTrue email validation restrictions
    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.display_name,
        signup_role: "citizen",
        phone: data.phone,
        region: data.region,
      },
    });

    if (error) throw new Error(error.message);
    
    // Assign role explicitly
    await supabaseAdmin.from("user_roles").insert({
      user_id: authData.user.id,
      role: "citizen"
    });

    return { ok: true, userId: authData.user.id };
  });

const technicianSignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string(),
  phone: z.string(),
  region: z.string(),
  technical_skill: z.string(),
  vehicle_available: z.boolean(),
});

export const technicianSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => technicianSignupInput.parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("submit_technician_application", {
      _email: data.email,
      _full_name: data.display_name,
      _phone: data.phone,
      _region: data.region,
      _technical_skill: data.technical_skill,
      _vehicle_available: data.vehicle_available,
      _raw_password: data.password
    });
    
    if (error) throw new Error(error.message);
    return { ok: true };
  });
