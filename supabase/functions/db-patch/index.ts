import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

Deno.serve(async (req) => {
  try {
    const databaseUrl = Deno.env.get('SUPABASE_DB_URL')
    if (!databaseUrl) throw new Error("SUPABASE_DB_URL is missing")

    const sql = postgres(databaseUrl)

    // Drop the buggy policies
    await sql`DROP POLICY IF EXISTS "technician_read_assigned_complaint_media" ON storage.objects;`
    await sql`DROP POLICY IF EXISTS "complaint_media_technician_insert" ON storage.objects;`
    await sql`DROP POLICY IF EXISTS "complaint_media_technician_update" ON storage.objects;`

    // Apply the fixed policies
    await sql`
      CREATE POLICY "technician_insert_resolution" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'complaint-media' AND
        private.has_role(auth.uid(), 'technician'::public.app_role) AND
        split_part(name, '/', 1) = auth.uid()::text AND
        split_part(name, '/', 2) = 'resolutions' AND
        EXISTS (
          SELECT 1 FROM public.complaints
          WHERE id::text = split_part(split_part(name, '/', 3), '.', 1)
          AND assigned_to = auth.uid()
        )
      );
    `

    await sql`
      CREATE POLICY "technician_update_resolution" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'complaint-media' AND
        private.has_role(auth.uid(), 'technician'::public.app_role) AND
        split_part(name, '/', 1) = auth.uid()::text AND
        split_part(name, '/', 2) = 'resolutions' AND
        EXISTS (
          SELECT 1 FROM public.complaints
          WHERE id::text = split_part(split_part(name, '/', 3), '.', 1)
          AND assigned_to = auth.uid()
        )
      );
    `

    await sql`
      CREATE POLICY "technician_select_resolution" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'complaint-media' AND
        private.has_role(auth.uid(), 'technician'::public.app_role) AND
        split_part(name, '/', 1) = auth.uid()::text AND
        split_part(name, '/', 2) = 'resolutions' AND
        EXISTS (
          SELECT 1 FROM public.complaints
          WHERE id::text = split_part(split_part(name, '/', 3), '.', 1)
          AND assigned_to = auth.uid()
        )
      );
    `

    await sql`
      CREATE POLICY "technician_read_citizen_media" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'complaint-media' AND
        private.has_role(auth.uid(), 'technician'::public.app_role) AND
        EXISTS (
          SELECT 1 FROM public.complaints
          WHERE id::text = split_part(split_part(name, '/', 2), '.', 1)
          AND assigned_to = auth.uid()
        )
      );
    `

    return new Response(JSON.stringify({ok: true, message: "Applied successfully v4"}), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({error: err.message}), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
