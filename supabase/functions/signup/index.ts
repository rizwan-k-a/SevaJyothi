import { withSupabase } from "npm:@supabase/server";
import { z } from "npm:zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TURNSTILE_SECRET =
  Deno.env.get("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000AA";

const SignupSchema = z.object({
  type: z.enum(["citizen", "technician"]),
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1),
  phone: z.string().optional(),
  region: z.string().optional(),
  technical_skill: z.string().optional(),
  vehicle_available: z.boolean().optional(),
  captcha_token: z.string().min(1),
});

async function verifyTurnstile(token: string, ip: string) {
  const formData = new FormData();
  formData.append("secret", TURNSTILE_SECRET);
  formData.append("response", token);
  formData.append("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  const outcome = await res.json();
  return outcome.success;
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const clientIp =
      req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "unknown";

    // Log helper
    const logAudit = (action: string, email: string | null, status: string) => {
      void ctx.supabaseAdmin
        .from("security_audit_log")
        .insert({
          ip_address: clientIp,
          action,
          email,
          status,
        })
        .then(() => {})
        .catch(() => {}); // fire and forget
    };

    try {
      // 1. Rate Limiting Check (5 attempts per 10 mins)
      const { data: rlData } = await ctx.supabaseAdmin
        .from("signup_rate_limit")
        .select("*")
        .eq("ip_address", clientIp)
        .maybeSingle();

      if (rlData) {
        // Is it within 10 minutes?
        const windowStart = new Date(rlData.window_started).getTime();
        const now = Date.now();
        if (now - windowStart < 10 * 60 * 1000) {
          if (rlData.attempt_count >= 5) {
            await logAudit("signup_rate_limit", null, "rejected");
            return Response.json(
              { error: "Too many signup attempts. Please try again later." },
              { status: 429, headers: corsHeaders },
            );
          }
          // increment
          await ctx.supabaseAdmin
            .from("signup_rate_limit")
            .update({ attempt_count: rlData.attempt_count + 1 })
            .eq("ip_address", clientIp);
        } else {
          // reset window
          await ctx.supabaseAdmin
            .from("signup_rate_limit")
            .update({ attempt_count: 1, window_started: new Date().toISOString() })
            .eq("ip_address", clientIp);
        }
      } else {
        await ctx.supabaseAdmin
          .from("signup_rate_limit")
          .insert({ ip_address: clientIp, attempt_count: 1 });
      }

      // 2. Input Validation
      const body = await req.json();
      const parseResult = SignupSchema.safeParse(body);

      if (!parseResult.success) {
        await logAudit("signup_validation", body?.email, "invalid_payload");
        return Response.json(
          { error: "Invalid input format" },
          { status: 400, headers: corsHeaders },
        );
      }

      const {
        type,
        email,
        password,
        display_name,
        phone,
        region,
        technical_skill,
        vehicle_available,
        captcha_token,
      } = parseResult.data;

      // 3. CAPTCHA Verification
      const captchaValid = await verifyTurnstile(captcha_token, clientIp);
      if (!captchaValid) {
        await logAudit("signup_captcha", email, "failed");
        return Response.json(
          { error: "Security check failed. Please try again." },
          { status: 400, headers: corsHeaders },
        );
      }

      // 4. Role Execution
      if (type === "citizen") {
        const { data: authData, error } = await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name,
            signup_role: "citizen", // Force strictly
            phone,
            region,
          },
        });

        if (error) {
          await logAudit("signup_create", email, "failed: " + error.message);
          throw new Error(error.message);
        }

        // Assign role explicitly
        await ctx.supabaseAdmin.from("user_roles").insert({
          user_id: authData.user.id,
          role: "citizen",
        });

        await logAudit("signup_citizen", email, "success");
        return Response.json({ ok: true, userId: authData.user.id }, { headers: corsHeaders });
      } else if (type === "technician") {
        // strictly route to application ONLY. Prevents auth account creation completely until admin approval.
        const { error } = await ctx.supabaseAdmin.rpc("submit_technician_application", {
          _email: email,
          _full_name: display_name,
          _phone: phone || null,
          _region: region || null,
          _technical_skill: technical_skill || null,
          _vehicle_available: vehicle_available || false,
          _raw_password: password,
        });

        if (error) {
          await logAudit("signup_technician_app", email, "failed: " + error.message);
          throw new Error(error.message);
        }
        await logAudit("signup_technician", email, "success_pending");
        return Response.json({ ok: true }, { headers: corsHeaders });
      } else {
        await logAudit("signup_role_abuse", email, "invalid_type");
        return Response.json(
          { error: "Invalid signup type" },
          { status: 400, headers: corsHeaders },
        );
      }
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 400, headers: corsHeaders });
    }
  }),
};
