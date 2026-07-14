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

    // Verify admin role
    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    if (!user)
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const { data: roles } = await ctx.supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r) => r.role === "authority");
    if (!isAdmin) {
      return Response.json(
        { error: "Forbidden: Admin access required" },
        { status: 403, headers: corsHeaders },
      );
    }

    const body = await req.json();
    const { action, id, banned } = body;

    try {
      if (action === "listApplications") {
        const { data, error } = await ctx.supabaseAdmin
          .from("technician_applications")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return Response.json(data ?? [], { headers: corsHeaders });
      } else if (action === "approveTechnician") {
        // Fetch the pending application
        const { data: app, error: appErr } = await ctx.supabaseAdmin
          .from("technician_applications")
          .select("*")
          .eq("id", id)
          .eq("status", "pending")
          .single();
        if (appErr || !app) throw new Error("Pending application not found");

        // Insert into user_roles
        const { error: roleErr } = await ctx.supabaseAdmin
          .from("user_roles")
          .insert({ user_id: app.user_id, role: "technician" });
        if (roleErr && roleErr.code !== '23505') throw new Error(roleErr.message);

        // Mark as approved
        const { error: updErr } = await ctx.supabaseAdmin
          .from("technician_applications")
          .update({ status: "approved", updated_at: new Date().toISOString() })
          .eq("id", id);
        if (updErr) throw new Error(updErr.message);

        return Response.json({ ok: true }, { headers: corsHeaders });
      } else if (action === "rejectTechnician") {
        const { error } = await ctx.supabaseAdmin
          .from("technician_applications")
          .update({ status: "rejected" })
          .eq("id", id);
        if (error) throw new Error(error.message);
        return Response.json({ ok: true }, { headers: corsHeaders });
      } else if (action === "listTechnicians") {
        const { data, error } = await ctx.supabaseAdmin.rpc("admin_list_users_by_role", { p_role: "technician" });
        if (error) throw new Error(error.message);
        
        // Map the data to add UI-specific fields (open_jobs, resolved_jobs)
        const technicians = (data || []).map((t: any) => ({
          ...t,
          open_jobs: 0,
          resolved_jobs: 0,
        }));
        
        return Response.json(technicians, { headers: corsHeaders });
      } else if (action === "listCitizens") {
        const { data, error } = await ctx.supabaseAdmin.rpc("admin_list_users_by_role", { p_role: "citizen" });
        if (error) throw new Error(error.message);
        
        return Response.json(data || [], { headers: corsHeaders });
      } else if (action === "setTechnicianBan") {
        const { data, error } = await ctx.supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: banned ? "87600h" : "none",
        });
        if (error) throw new Error(error.message);
        return Response.json({ ok: true, user: data.user }, { headers: corsHeaders });
      } else if (action === "deleteTechnician" || action === "deleteUser") {
        const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(id);
        if (error) throw new Error(error.message);
        return Response.json({ ok: true }, { headers: corsHeaders });
      } else {
        return Response.json({ error: "Invalid action" }, { status: 400, headers: corsHeaders });
      }
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 400, headers: corsHeaders });
    }
  }),
};
