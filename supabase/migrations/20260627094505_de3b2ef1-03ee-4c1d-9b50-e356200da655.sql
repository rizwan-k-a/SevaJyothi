
-- Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Storage policies on complaint-media bucket
CREATE POLICY "complaint_media_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "complaint_media_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'complaint-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'authority')
      OR public.has_role(auth.uid(), 'technician')
    )
  );
