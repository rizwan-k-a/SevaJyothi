-- Provision the 'complaint-media' storage bucket
insert into storage.buckets (id, name, public)
values ('complaint-media', 'complaint-media', true)
on conflict (id) do nothing;

-- Set up basic RLS for the bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'complaint-media' );

create policy "Authenticated users can upload media"
  on storage.objects for insert
  with check ( bucket_id = 'complaint-media' and auth.role() = 'authenticated' );

create policy "Users can update their own media"
  on storage.objects for update
  using ( bucket_id = 'complaint-media' and auth.uid() = owner );

create policy "Users can delete their own media"
  on storage.objects for delete
  using ( bucket_id = 'complaint-media' and auth.uid() = owner );
