-- M2 · Receipt photos on expenses and supplier bills (01-PRODUCT §3.8, §3.9).
-- Photos live in the private Storage bucket `receipts` under `<business_id>/<kind>/<row id>-<random>.<ext>`.
-- The front desk uploads and reads its own business's photos; nobody can change or delete one, and a row
-- keeps the first photo attached to it (nothing financial is ever deleted).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "front desk uploads receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] in (
    select m.business_id::text from public.members m
    where m.user_id = auth.uid() and m.active and m.role in ('owner', 'cashier')));
create policy "front desk reads receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] in (
    select m.business_id::text from public.members m
    where m.user_id = auth.uid() and m.active and m.role in ('owner', 'cashier', 'accountant')));

alter table public.expenses add column receipt_path text;
alter table public.purchase_bills add column receipt_path text;

-- Attach an uploaded photo to an expense or a bill. p_kind: 'expense' | 'bill'.
-- Owner: any row. Cashier: rows they added. The path must be in the row's business folder.
create function public.attach_receipt(p_kind text, p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid;
  v_branch uuid;
  v_creator uuid;
  v_current text;
  m members;
begin
  if p_kind = 'expense' then
    select business_id, branch_id, created_by, receipt_path into v_business, v_branch, v_creator, v_current
    from expenses where id = p_id;
  elsif p_kind = 'bill' then
    select business_id, branch_id, created_by, receipt_path into v_business, v_branch, v_creator, v_current
    from purchase_bills where id = p_id;
  else
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_business is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
  if m.role = 'cashier' and v_creator is distinct from m.id then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_current is not null then
    raise exception 'receipt_exists' using errcode = '22023';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> v_business::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = p_path) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  if p_kind = 'expense' then
    update expenses set receipt_path = p_path where id = p_id;
  else
    update purchase_bills set receipt_path = p_path where id = p_id;
  end if;
  perform public.write_audit(v_business, v_branch, m.id, 'attach', p_kind, p_id, 'Added a receipt photo');
end;
$$;

revoke execute on function public.attach_receipt(text, uuid, text) from public, anon;
grant execute on function public.attach_receipt(text, uuid, text) to authenticated;
