-- Kralupy has a second level of rooms 1-15 under the roof (Airtable "roof?" = "Дах"),
-- numbered the same as the rooms below, so the roof flag is part of the room's identity.
alter table public.rooms add column is_roof boolean not null default false;

alter table public.rooms drop constraint rooms_property_id_type_number_key;
alter table public.rooms
  add constraint rooms_property_id_type_number_is_roof_key unique (property_id, type, number, is_roof);

create or replace view public.place_occupancy
with (security_invoker = true)
as
select
  p.id            as place_id,
  p.number        as place_number,
  p.status        as place_status,
  r.id            as room_id,
  r.number        as room_number,
  r.type          as room_type,
  r.property_id,
  s.id            as stay_id,
  s.tenant_id,
  t.full_name     as tenant_name,
  s.check_in_date,
  r.is_roof       as room_is_roof
from public.places p
join public.rooms r on r.id = p.room_id
left join lateral (
  select st.*
  from public.stay_places sp
  join public.stays st on st.id = sp.stay_id
  where sp.place_id = p.id and st.status = 'active'
  limit 1
) s on true
left join public.tenants t on t.id = s.tenant_id
where not p.is_archived;
