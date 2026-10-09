-- Read access for the app: profiles created on sign-up, role-based RLS read policies,
-- and app_snapshot() — everything the app renders in one call, filtered by those policies.
-- Write policies come with the write paths; until then only the service role writes.

-- ---------------------------------------------------------------------------
-- profiles follow auth.users; new accounts start as 'client' until an admin promotes them
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- access helpers (private schema: not exposed through the Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

-- admins and team members see every property; house managers and clients only theirs
create or replace function private.can_see_property(property uuid)
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
    when 'client' then exists (
      select 1 from public.profile_properties where profile_id = auth.uid() and property_id = property)
    else false
  end
$$;

grant execute on function private.app_role() to authenticated;
grant execute on function private.can_see_property(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- read policies; `(select private.app_role())` runs once per query, so staff skip the per-row check
-- ---------------------------------------------------------------------------
create policy "read properties" on public.properties for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or private.can_see_property(id));

create policy "read rooms" on public.rooms for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or private.can_see_property(property_id));

create policy "read places" on public.places for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or exists (
    select 1 from public.rooms r where r.id = room_id and private.can_see_property(r.property_id)));

create policy "read stays" on public.stays for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or private.can_see_property(property_id));

create policy "read stay places" on public.stay_places for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or exists (
    select 1 from public.stays s where s.id = stay_id and private.can_see_property(s.property_id)));

-- clients never see residents' personal data
create policy "read tenants" on public.tenants for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or (
    (select private.app_role()) = 'house_manager' and exists (
      select 1 from public.stays s where s.tenant_id = tenants.id and private.can_see_property(s.property_id))));

create policy "read bookings" on public.bookings for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or private.can_see_property(property_id));

create policy "read registrations" on public.registrations for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or private.can_see_property(property_id));

create policy "read money transfers" on public.money_transfers for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or (
    (select private.app_role()) = 'house_manager' and private.can_see_property(property_id)));

create policy "read payments" on public.payments for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or (
    (select private.app_role()) = 'house_manager' and private.can_see_property(property_id)));

create policy "read tenant documents" on public.tenant_documents for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member', 'house_manager'));

create policy "read floor plans" on public.floor_plans for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or private.can_see_property(property_id));

create policy "read floor zones" on public.floor_zones for select to authenticated
  using ((select private.app_role()) in ('admin', 'team_member') or exists (
    select 1 from public.floor_plans fp where fp.id = plan_id and private.can_see_property(fp.property_id)));

create policy "read own or team profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or (select private.app_role()) in ('admin', 'team_member'));

create policy "read own or all property links" on public.profile_properties for select to authenticated
  using (profile_id = auth.uid() or (select private.app_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- app_snapshot: the whole app state in one round trip (RLS applies: security invoker)
-- ---------------------------------------------------------------------------
create or replace function public.app_snapshot(lookback_days integer default 120)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with recent_stays as (
    select * from public.stays s
    where s.status = 'active' or s.check_out_date >= current_date - lookback_days
  ),
  recent_bookings as (
    select * from public.bookings b
    where b.status = 'new' or b.start_date >= current_date - lookback_days
  ),
  people as (
    select tenant_id as id from recent_stays
    union select tenant_id from recent_bookings where tenant_id is not null
    union select payer_tenant_id from recent_bookings where payer_tenant_id is not null
  ),
  property_stats as (
    select p.id,
      coalesce((select sum(s.legacy_paid_total) from public.stays s where s.property_id = p.id), 0)
        + coalesce((select sum(pm.amount) from public.payments pm where pm.property_id = p.id), 0) as paid_total,
      coalesce((select sum(m.amount) from public.money_transfers m
                where m.property_id = p.id and m.status = 'received'), 0) as received_total,
      (select count(*) from public.registrations g where g.property_id = p.id and g.status = 'registered') as registered,
      (select min(r.internal_price) from public.rooms r
       where r.property_id = p.id and r.status = 'available' and r.internal_price > 0) as min_internal_price,
      (select count(*) from public.bookings b where b.property_id = p.id and b.status = 'new'
         and not b.is_family and b.tenant_gender = 'male') as booked_male,
      (select count(*) from public.bookings b where b.property_id = p.id and b.status = 'new'
         and not b.is_family and b.tenant_gender = 'female') as booked_female,
      (select count(*) from public.bookings b where b.property_id = p.id and b.status = 'new'
         and b.is_family) as booked_family
    from public.properties p
  )
  select jsonb_build_object(
    'properties', (select coalesce(jsonb_agg(to_jsonb(p) || to_jsonb(ps) order by p.legacy_number), '[]')
                   from public.properties p join property_stats ps on ps.id = p.id),
    'rooms', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.rooms r),
    'places', (select coalesce(jsonb_agg(to_jsonb(pl)), '[]') from public.places pl where not pl.is_archived),
    'stays', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', s.id, 'tenant_id', s.tenant_id, 'property_id', s.property_id, 'status', s.status,
                'check_in_date', s.check_in_date, 'original_check_in_date', s.original_check_in_date,
                'check_out_date', s.check_out_date, 'price_type', s.price_type, 'price_per_day', s.price_per_day,
                'manager_name', s.manager_name, 'project_name', s.project_name,
                'legacy_paid_total', s.legacy_paid_total, 'legacy_debt', s.legacy_debt,
                'needs_review', s.needs_review)), '[]')
              from recent_stays s),
    'stay_places', (select coalesce(jsonb_agg(jsonb_build_object('stay_id', sp.stay_id, 'place_id', sp.place_id)), '[]')
                    from public.stay_places sp join recent_stays s on s.id = sp.stay_id),
    'tenants', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', t.id, 'full_name', t.full_name, 'gender', t.gender, 'phone', t.phone,
                  'birth_date', t.birth_date, 'type', t.type, 'avatar_path', t.avatar_path)), '[]')
                from public.tenants t where t.id in (select id from people)),
    'tenant_documents', (select coalesce(jsonb_agg(jsonb_build_object(
                           'id', d.id, 'tenant_id', d.tenant_id, 'kind', d.kind,
                           'storage_path', d.storage_path, 'file_name', d.file_name)), '[]')
                         from public.tenant_documents d where d.tenant_id in (select id from people)),
    'bookings', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', b.id, 'property_id', b.property_id, 'tenant_name', coalesce(b.tenant_name, t.full_name),
                   'tenant_type', t.type, 'price_type', b.price_type, 'start_date', b.start_date, 'status', b.status,
                   'note', b.note, 'comment', b.comment, 'creator_name', b.creator_name,
                   'manager_name', b.manager_name, 'manager_project', b.manager_project,
                   'payer_name', payer.full_name, 'is_family', b.is_family,
                   'discount', b.discount, 'discount_percent', b.discount_percent)), '[]')
                 from recent_bookings b
                 left join public.tenants t on t.id = b.tenant_id
                 left join public.tenants payer on payer.id = b.payer_tenant_id),
    'registrations', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', g.id, 'property_id', g.property_id, 'full_name', g.full_name, 'type', g.type,
                        'status', g.status, 'creator_name', g.creator_name, 'visa_manager_name', g.visa_manager_name,
                        'start_date', g.start_date, 'expiration_date', g.expiration_date,
                        'file_names', g.file_names, 'files', g.files)), '[]')
                      from public.registrations g),
    'transfers', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', m.id, 'property_id', m.property_id, 'sender_name', m.sender_name,
                    'courier_name', m.courier_name, 'receiver_name', m.receiver_name, 'amount', m.amount,
                    'status', m.status, 'created_at', m.created_at)), '[]')
                  from public.money_transfers m),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', pm.id, 'stay_id', pm.stay_id, 'property_id', pm.property_id, 'amount', pm.amount,
                   'paid_at', pm.paid_at, 'proof_path', pm.proof_path, 'note', pm.note, 'by', pr.full_name)), '[]')
                 from public.payments pm left join public.profiles pr on pr.id = pm.created_by),
    'profiles', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', pr.id, 'full_name', pr.full_name, 'email', pr.email, 'role', pr.role)), '[]')
                 from public.profiles pr where pr.is_active),
    'floor_plans', (select coalesce(jsonb_agg(to_jsonb(fp)), '[]') from public.floor_plans fp),
    'floor_zones', (select coalesce(jsonb_agg(to_jsonb(fz)), '[]') from public.floor_zones fz),
    'me', (select jsonb_build_object(
             'id', pr.id, 'full_name', pr.full_name, 'email', pr.email, 'role', pr.role, 'language', pr.language,
             'property_ids', (select coalesce(jsonb_agg(pp.property_id), '[]')
                              from public.profile_properties pp where pp.profile_id = pr.id))
           from public.profiles pr where pr.id = auth.uid())
  )
$$;

revoke execute on function public.app_snapshot(integer) from public, anon;
grant execute on function public.app_snapshot(integer) to authenticated;
