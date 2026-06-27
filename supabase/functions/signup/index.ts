import { withSupabase } from 'npm:@supabase/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    }
    
    const body = await req.json();
    const { type, email, password, display_name, phone, region, technical_skill, vehicle_available } = body;

    try {
      if (type === 'citizen') {
        const { data: authData, error } = await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name,
            signup_role: "citizen",
            phone,
            region,
          },
        });

        if (error) throw new Error(error.message);
        
        // Assign role explicitly
        await ctx.supabaseAdmin.from("user_roles").insert({
          user_id: authData.user.id,
          role: "citizen"
        });

        return Response.json({ ok: true, userId: authData.user.id }, { headers: corsHeaders });
      } else if (type === 'technician') {
        const { error } = await ctx.supabaseAdmin.rpc("submit_technician_application", {
          _email: email,
          _full_name: display_name,
          _phone: phone,
          _region: region,
          _technical_skill: technical_skill,
          _vehicle_available: vehicle_available,
          _raw_password: password
        });
        
        if (error) throw new Error(error.message);
        return Response.json({ ok: true }, { headers: corsHeaders });
      } else {
        return Response.json({ error: 'Invalid signup type' }, { status: 400, headers: corsHeaders });
      }
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 400, headers: corsHeaders });
    }
  })
}
