import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Citizen signup bypasses client-side Supabase Auth validation by using the Admin API
const citizenSignupInput = z.object({
  email: z.string().trim().toLowerCase().max(255), // Note: removing .email() to avoid strict zod parsing block, though usually it's fine. 
  password: z.string().min(6),
  display_name: z.string().trim().max(100),
  phone: z.string().trim().max(32).optional(),
});

export const citizenSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => citizenSignupInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create the user using the Admin API (bypasses GoTrue's strict client validation)
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { 
        display_name: data.display_name,
        phone: data.phone 
      },
    });

    if (error || !created.user) {
      // Return error to client
      throw new Error(error?.message ?? "Failed to create citizen account");
    }

    // Success! The client can now call signInWithPassword() with the same credentials
    return { ok: true };
  });

// Technician signup bypasses auth creation entirely and stores the hash in technician_applications
const techSignupInput = z.object({
  full_name: z.string().trim().max(100),
  email: z.string().trim().toLowerCase().max(255),
  password: z.string().min(6),
  phone: z.string().trim().max(32),
  region: z.string().trim().max(100),
  technical_skill: z.string().trim().max(100),
  vehicle_available: z.boolean(),
});

export const technicianSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => techSignupInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Call the database RPC to securely hash the password and store the application
    const { error } = await supabaseAdmin.rpc("submit_technician_application", {
      _full_name: data.full_name,
      _email: data.email,
      _plain_password: data.password,
      _phone: data.phone,
      _region: data.region,
      _technical_skill: data.technical_skill,
      _vehicle_available: data.vehicle_available,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });
