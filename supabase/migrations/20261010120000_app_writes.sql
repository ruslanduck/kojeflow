-- Write access for the app: admins and team members change operational data everywhere,
-- house managers only in their own properties, clients never. Rooms and beds are edited by
-- admins and team members only. Files live in private buckets with matching rules.

create or replace function private.can_edit_property(property uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.app_role()
    when 'admin' then true
    when 'team_member' then true
    when 'house_manager' then exists (
      select 1 from public.profile_properties where profile_id = auth.uid() and property_id = property)
    else false
  end
$$;

grant execute on function private.can_edit_property(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- residents and their documents
-- ---------------------------------------------------------------------------
create policy "staff add tenants" on public.tenants for insert to authenticated
  with check ((select private.app_role()) in ('admin', 'team_member', 'house_manager'));
create policy "staff edit tenants" on public.tenants for update to authenticated
  using ((select private.app_role()) in ('admin', 'team_member', 'house_manager'))
  with check ((select private.app_role()) in ('admin', 'team_member', 'house_manager'));

create policy "staff add tenant documents" on public.tenant_documents for insert to authenticated
  with check ((select private.app_role()) in ('admin', 'team_member', 'house_manager'));
create policy "staff delete tenant documents" on public.tenant_documents for delete to authenticated
  using ((select private.app_role()) in ('admin', 'team_member', 'house_manager'));

-- ---------------------------------------------------------------------------
-- stays, beds held, bookings, payments
-- ---------------------------------------------------------------------------
create policy "staff add stays" on public.stays for insert to authenticated
  with check (private.can_edit_property(property_id));
create policy "staff edit stays" on public.stays for update to authenticated
  using (private.can_edit_property(property_id))
  with check (private.can_edit_property(property_id));

create policy "staff assign beds" on public.stay_places for insert to authenticated
  with check (exists (select 1 from public.stays s where s.id = stay_id and private.can_edit_property(s.property_id)));
create policy "staff release beds" on public.stay_places for delete to authenticated
  using (exists (select 1 from public.stays s where s.id = stay_id and private.can_edit_property(s.property_id)));

create policy "staff add bookings" on public.bookings for insert to authenticated
  with check (private.can_edit_property(property_id));
create policy "staff edit bookings" on public.bookings for update to authenticated
  using (private.can_edit_property(property_id))
  with check (private.can_edit_property(property_id));

-- a payment is always recorded as its author
create policy "staff add payments" on public.payments for insert to authenticated
  with check (private.can_edit_property(property_id) and created_by = auth.uid());
create policy "admins correct payments" on public.payments for delete to authenticated
  using ((select private.app_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- rooms and beds
-- ---------------------------------------------------------------------------
create policy "admins and team edit rooms" on public.rooms for all to authenticated
  using ((select private.app_role()) in ('admin', 'team_member'))
  with check ((select private.app_role()) in ('admin', 'team_member'));
create policy "admins and team edit beds" on public.places for all to authenticated
  using ((select private.app_role()) in ('admin', 'team_member'))
  with check ((select private.app_role()) in ('admin', 'team_member'));

-- ---------------------------------------------------------------------------
-- files: passport scans and avatars, payment proofs
-- ---------------------------------------------------------------------------
create policy "staff read tenant files" on storage.objects for select to authenticated
  using (bucket_id = 'tenant-documents' and (select private.app_role()) in ('admin', 'team_member', 'house_manager'));
create policy "staff upload tenant files" on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-documents' and (select private.app_role()) in ('admin', 'team_member', 'house_manager'));
create policy "staff delete tenant files" on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-documents' and (select private.app_role()) in ('admin', 'team_member', 'house_manager'));

create policy "staff read payment proofs" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (select private.app_role()) in ('admin', 'team_member', 'house_manager'));
create policy "staff upload payment proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (select private.app_role()) in ('admin', 'team_member', 'house_manager'));
