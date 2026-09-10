drop policy if exists salon_document_insert on public.salon_documents;
create policy salon_document_insert on public.salon_documents for insert to authenticated
with check (salon_private.has_shop_role(shop_id,array['owner','shop_admin','cashier']));

drop policy if exists salon_file_insert on storage.objects;
create policy salon_file_insert on storage.objects for insert to authenticated
with check (bucket_id='salon-documents' and salon_private.has_shop_role(
  ((storage.foldername(name))[1])::uuid,array['owner','shop_admin','cashier']));

comment on policy salon_document_insert on public.salon_documents is
  'Owners, shop administrators and cashiers may attach tenant-scoped operational evidence.';
