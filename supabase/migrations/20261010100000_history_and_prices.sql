-- Real history for the dashboard date picker and the room log (the app used to fabricate both).

-- beds held on a given day, per property; a stay holds its beds from check-in up to, not including, check-out
create or replace function public.occupancy_on(day date)
returns table (property_id uuid, occupied integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.property_id, count(distinct sp.place_id)::integer
  from public.stays s
  join public.stay_places sp on sp.stay_id = s.id
  join public.places pl on pl.id = sp.place_id
  join public.rooms r on r.id = pl.room_id
  where s.status <> 'cancelled'
    and s.check_in_date <= day
    and ((s.status = 'active' and s.check_out_date is null) or s.check_out_date > day)
  group by r.property_id
$$;

-- everyone who has lived in a room, newest first
create or replace function public.room_history(room uuid)
returns table (
  stay_id uuid, tenant_id uuid, tenant_name text, gender text,
  place_number integer, check_in date, check_out date, status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, t.id, t.full_name, t.gender, pl.number, s.check_in_date, s.check_out_date, s.status
  from public.places pl
  join public.stay_places sp on sp.place_id = pl.id
  join public.stays s on s.id = sp.stay_id
  join public.tenants t on t.id = s.tenant_id
  where pl.room_id = room
  order by s.check_in_date desc, pl.number
  limit 300
$$;

revoke execute on function public.occupancy_on(date) from public, anon;
revoke execute on function public.room_history(uuid) from public, anon;
grant execute on function public.occupancy_on(date) to authenticated;
grant execute on function public.room_history(uuid) to authenticated;
