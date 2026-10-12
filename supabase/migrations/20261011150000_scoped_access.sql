-- Access scoped to the properties a house manager works with (found in the bug hunt, latent until
-- the first house manager / client account exists). Admins and team members keep full access.

-- A tenant is "theirs" when they stay (or stayed) in a property the user can see.
create or replace function private.can_see_tenant(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.app_role()) in ('admin', 'team_member')
      or ((select private.app_role()) = 'house_manager'
          and exists (select 1 from public.stays s where s.tenant_id = p_tenant and private.can_see_property(s.property_id)));
$$;

-- A tenant nobody has ever checked in: a brand-new record a house manager may take on.
create or replace function private.tenant_is_new(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.stays s where s.tenant_id = p_tenant);
$$;

create or replace function private.place_property(p_place uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.property_id from public.places pl join public.rooms r on r.id = pl.room_id where pl.id = p_place;
$$;

-- ---- tenants: house managers edit only their own residents (or one they just created)
drop policy "staff edit tenants" on public.tenants;
create policy "staff edit tenants" on public.tenants for update to authenticated
  using (private.can_see_tenant(id) or ((select private.app_role()) = 'house_manager' and private.tenant_is_new(id)))
  with check (private.can_see_tenant(id) or ((select private.app_role()) = 'house_manager' and private.tenant_is_new(id)));

-- ---- stays: a stay may only be opened for a resident of one's own properties or a new one,
-- so nobody can attach a stay to a stranger just to read their record
drop policy "staff add stays" on public.stays;
create policy "staff add stays" on public.stays for insert to authenticated
  with check (private.can_edit_property(property_id)
              and (private.can_see_tenant(tenant_id) or private.tenant_is_new(tenant_id)));
drop policy "staff edit stays" on public.stays;
create policy "staff edit stays" on public.stays for update to authenticated
  using (private.can_edit_property(property_id))
  with check (private.can_edit_property(property_id) and private.can_see_tenant(tenant_id));

-- ---- stay_places: the bed must belong to the stay's property
drop policy "staff assign beds" on public.stay_places;
create policy "staff assign beds" on public.stay_places for insert to authenticated
  with check (exists (select 1 from public.stays s
                      where s.id = stay_places.stay_id
                        and private.can_edit_property(s.property_id)
                        and private.place_property(stay_places.place_id) = s.property_id));

-- ---- tenant documents (rows and files): only for one's own residents; deleting is staff or the uploader
drop policy "read tenant documents" on public.tenant_documents;
create policy "read tenant documents" on public.tenant_documents for select to authenticated
  using (private.can_see_tenant(tenant_id));
drop policy "staff add tenant documents" on public.tenant_documents;
create policy "staff add tenant documents" on public.tenant_documents for insert to authenticated
  with check (private.can_see_tenant(tenant_id)
              or ((select private.app_role()) = 'house_manager' and private.tenant_is_new(tenant_id)));
drop policy "staff delete tenant documents" on public.tenant_documents;
create policy "staff delete tenant documents" on public.tenant_documents for delete to authenticated
  using ((select private.app_role()) in ('admin', 'team_member')
         or (private.can_see_tenant(tenant_id) and uploaded_by = auth.uid()));

-- files are stored as <tenant id>/...
drop policy "staff read tenant files" on storage.objects;
create policy "staff read tenant files" on storage.objects for select to authenticated
  using (bucket_id = 'tenant-documents' and private.can_see_tenant(((storage.foldername(name))[1])::uuid));
drop policy "staff upload tenant files" on storage.objects;
create policy "staff upload tenant files" on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-documents'
              and (private.can_see_tenant(((storage.foldername(name))[1])::uuid)
                   or ((select private.app_role()) = 'house_manager' and private.tenant_is_new(((storage.foldername(name))[1])::uuid))));
drop policy "staff delete tenant files" on storage.objects;
create policy "staff delete tenant files" on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-documents'
         and ((select private.app_role()) in ('admin', 'team_member')
              or (private.can_see_tenant(((storage.foldername(name))[1])::uuid) and owner_id = auth.uid()::text)));

-- payment proofs are stored as <property id>/<stay id>/...
drop policy "staff read payment proofs" on storage.objects;
create policy "staff read payment proofs" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs'
         and ((select private.app_role()) in ('admin', 'team_member')
              or ((select private.app_role()) = 'house_manager' and private.can_see_property(((storage.foldername(name))[1])::uuid))));
drop policy "staff upload payment proofs" on storage.objects;
create policy "staff upload payment proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and private.can_edit_property(((storage.foldername(name))[1])::uuid));
-- admins may remove a proof (e.g. a test or a wrong file)
create policy "admins delete payment proofs" on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and (select private.app_role()) = 'admin');

-- payments must point at a stay of the same property
drop policy "staff add payments" on public.payments;
create policy "staff add payments" on public.payments for insert to authenticated
  with check (private.can_edit_property(property_id) and created_by = (select auth.uid())
              and exists (select 1 from public.stays s where s.id = payments.stay_id and s.property_id = payments.property_id));

-- floor plans are stored as <property id>/...
drop policy "staff read floor plan images" on storage.objects;
create policy "staff read floor plan images" on storage.objects for select to authenticated
  using (bucket_id = 'floor-plans' and private.can_see_property(((storage.foldername(name))[1])::uuid));

-- ---- clients: occupancy only. Bookings and registrations carry names, phones and passport numbers.
drop policy "read bookings" on public.bookings;
create policy "read bookings" on public.bookings for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member')
         or ((select private.app_role()) = 'house_manager' and private.can_see_property(property_id)));
drop policy "read registrations" on public.registrations;
create policy "read registrations" on public.registrations for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member')
         or ((select private.app_role()) = 'house_manager' and private.can_see_property(property_id)));

-- registrations are now created and edited in the app
create policy "staff add registrations" on public.registrations for insert to authenticated
  with check ((select private.app_role()) in ('admin', 'team_member')
              or ((select private.app_role()) = 'house_manager' and private.can_edit_property(property_id)));
create policy "staff edit registrations" on public.registrations for update to authenticated
  using ((select private.app_role()) in ('admin', 'team_member')
         or ((select private.app_role()) = 'house_manager' and private.can_edit_property(property_id)))
  with check ((select private.app_role()) in ('admin', 'team_member')
              or ((select private.app_role()) = 'house_manager' and private.can_edit_property(property_id)));

-- ---- one active stay per bed, for real: sees every stay whatever the caller's rights, and
-- serialises two check-ins into the same bed with a row lock
create or replace function public.assert_place_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.places where id = new.place_id for update;
  if exists (select 1 from public.stays s where s.id = new.stay_id and s.status = 'active')
     and exists (
       select 1
       from public.stay_places sp
       join public.stays s on s.id = sp.stay_id
       where sp.place_id = new.place_id and sp.stay_id <> new.stay_id and s.status = 'active'
     ) then
    raise exception 'place % already has an active stay', new.place_id using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.assert_place_free() from public, anon, authenticated;

-- a room with residents can't be switched off either (the guard only covered archiving)
create or replace function private.guard_occupied_room()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if ((new.is_archived and not old.is_archived) or (new.status <> 'available' and old.status = 'available'))
     and exists (select 1 from public.places p where p.room_id = new.id and private.place_has_active_stay(p.id)) then
    raise exception 'Room % has residents', old.number using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger guard_occupied_room on public.rooms;
create trigger guard_occupied_room
before update of is_archived, status on public.rooms
for each row execute function private.guard_occupied_room();
