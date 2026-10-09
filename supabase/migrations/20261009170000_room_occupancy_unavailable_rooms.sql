-- An unavailable room offers no beds, same as Airtable's capacity formula.
create or replace view public.room_occupancy
with (security_invoker = true)
as
select
  r.id as room_id,
  r.property_id,
  count(po.place_id) filter (where r.status = 'available' and po.place_status = 'available')                         as capacity,
  count(po.stay_id)                                                                                                  as occupied,
  count(po.place_id) filter (where r.status = 'available' and po.place_status = 'available' and po.stay_id is null) as free
from public.rooms r
left join public.place_occupancy po on po.room_id = r.id
group by r.id, r.property_id;
