import { withSupabase } from "npm:@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    // Verify user is authenticated
    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    try {
      const body = await req.json();
      const { path, dataUrl, contentType } = body;

      if (!path || !dataUrl) {
        return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
      }

      // Ensure user can only upload to their own folder (security check)
      if (!path.startsWith(user.id + "/")) {
        return Response.json({ error: "Forbidden: Invalid path" }, { status: 403, headers: corsHeaders });
      }

      // Convert dataUrl (base64) to buffer
      // Format is usually: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Upload using service_role to bypass storage RLS
      const { data, error } = await ctx.supabaseAdmin.storage
        .from("complaint-media")
        .upload(path, buffer, {
          contentType: contentType || "image/jpeg",
          upsert: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      return Response.json({ ok: true, data }, { headers: corsHeaders });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 400, headers: corsHeaders });
    }
  }),
};
