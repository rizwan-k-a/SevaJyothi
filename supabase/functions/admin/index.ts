import { withSupabase } from 'npm:@supabase/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }
    
    // Verify admin role
    const { data: { user } } = await ctx.supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { data: roles } = await ctx.supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    
    const isAdmin = roles?.some(r => r.role === 'authority')
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, id, banned } = body;

    try {
      if (action === 'listApplications') {
        const { data, error } = await ctx.supabaseAdmin
          .from("technician_applications")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return Response.json(data ?? [], { headers: corsHeaders });
      } 
      else if (action === 'approveTechnician') {
        const { error } = await ctx.supabaseAdmin.rpc("approve_technician_application", {
          _application_id: id,
        });
        if (error) throw new Error(error.message);
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
      else if (action === 'rejectTechnician') {
        const { error } = await ctx.supabaseAdmin
          .from("technician_applications")
          .update({ status: "rejected" })
          .eq("id", id);
        if (error) throw new Error(error.message);
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
      else if (action === 'listTechnicians') {
        return Response.json([], { headers: corsHeaders });
      }
      else if (action === 'listCitizens') {
        return Response.json([], { headers: corsHeaders });
      }
      else if (action === 'setTechnicianBan') {
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
      else if (action === 'deleteTechnician') {
        return Response.json({ ok: true }, { headers: corsHeaders });
      }
      else {
        return Response.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders });
      }
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 400, headers: corsHeaders });
    }
  })
}
