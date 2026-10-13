-- Stays carry the commercial customer (Airtable kept it apart from the internal project).

CREATE OR REPLACE FUNCTION public.app_snapshot(lookback_days integer DEFAULT 120)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with flags as (
    select coalesce((select private.app_role()) = 'client', false) as is_client
  ),
  recent_stays as (
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
      (select count(*) from public.registrations g
        where g.property_id = p.id and g.status = 'registered'
          and (g.expiration_date is null or g.expiration_date >= current_date)) as registered,
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
                'manager_name', s.manager_name, 'project_name', s.project_name, 'customer', s.customer,
                'needs_review', s.needs_review) order by s.check_in_date desc, s.id), '[]')
              from recent_stays s),
    'stay_places', (select coalesce(jsonb_agg(jsonb_build_object('stay_id', sp.stay_id, 'place_id', sp.place_id)), '[]')
                    from public.stay_places sp join recent_stays s on s.id = sp.stay_id),
    'tenants', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', t.id,
                  'full_name', case when f.is_client then null else t.full_name end,
                  'gender', t.gender,
                  'phone', case when f.is_client then null else t.phone end,
                  'birth_date', case when f.is_client then null else t.birth_date end,
                  'type', t.type,
                  'avatar_path', case when f.is_client then null else t.avatar_path end)), '[]')
                from public.tenants t cross join flags f where t.id in (select id from people)),
    'tenant_documents', (select coalesce(jsonb_agg(jsonb_build_object(
                           'id', d.id, 'tenant_id', d.tenant_id, 'kind', d.kind,
                           'storage_path', d.storage_path, 'file_name', d.file_name)), '[]')
                         from public.tenant_documents d cross join flags f
                         where not f.is_client and d.tenant_id in (select id from people)),
    'bookings', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', b.id, 'property_id', b.property_id, 'tenant_id', b.tenant_id,
                   'tenant_name', case when f.is_client then null else coalesce(b.tenant_name, t.full_name) end,
                   'tenant_gender', coalesce(b.tenant_gender, t.gender),
                   'tenant_type', t.type, 'price_type', b.price_type, 'start_date', b.start_date, 'status', b.status,
                   'note', b.note, 'comment', b.comment, 'creator_name', b.creator_name,
                   'manager_name', b.manager_name, 'manager_project', b.manager_project,
                   'payer_name', coalesce(b.payer_name, payer.full_name), 'is_family', b.is_family,
                   'discount', b.discount, 'discount_percent', b.discount_percent)
                   order by b.start_date desc nulls last, b.id), '[]')
                 from recent_bookings b
                 cross join flags f
                 left join public.tenants t on t.id = b.tenant_id
                 left join public.tenants payer on payer.id = b.payer_tenant_id),
    'registrations', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', g.id, 'property_id', g.property_id, 'tenant_id', g.tenant_id,
                        'full_name', case when f.is_client then null else g.full_name end,
                        'type', g.type, 'status', g.status, 'creator_name', g.creator_name,
                        'visa_manager_name', g.visa_manager_name,
                        'start_date', g.start_date, 'expiration_date', g.expiration_date,
                        'file_names', g.file_names,
                        'file_count', (length(coalesce(g.files, '')) - length(replace(coalesce(g.files, ''), 'http', ''))) / 4)
                        order by g.start_date desc nulls last, g.id), '[]')
                      from public.registrations g cross join flags f),
    'transfers', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', m.id, 'property_id', m.property_id, 'sender_name', m.sender_name,
                    'courier_name', m.courier_name, 'receiver_name', m.receiver_name, 'amount', m.amount,
                    'status', m.status, 'created_at', m.created_at) order by m.created_at desc), '[]')
                  from public.money_transfers m),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', pm.id, 'stay_id', pm.stay_id, 'property_id', pm.property_id, 'amount', pm.amount,
                   'paid_at', pm.paid_at, 'proof_path', pm.proof_path, 'note', pm.note, 'by', pr.full_name)
                   order by pm.paid_at desc), '[]')
                 from public.payments pm left join public.profiles pr on pr.id = pm.created_by),
    'profiles', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', pr.id, 'full_name', pr.full_name, 'email', pr.email, 'role', pr.role)), '[]')
                 from public.profiles pr where pr.is_active),
    'floor_plans', (select coalesce(jsonb_agg(to_jsonb(fp)), '[]') from public.floor_plans fp),
    'floor_zones', (select coalesce(jsonb_agg(to_jsonb(fz)), '[]') from public.floor_zones fz),
    'me', (select jsonb_build_object(
             'id', pr.id, 'full_name', pr.full_name, 'email', pr.email, 'role', pr.role, 'language', pr.language,
             'is_active', pr.is_active,
             'property_ids', (select coalesce(jsonb_agg(pp.property_id), '[]')
                              from public.profile_properties pp where pp.profile_id = pr.id))
           from public.profiles pr where pr.id = auth.uid())
  )
$function$;
