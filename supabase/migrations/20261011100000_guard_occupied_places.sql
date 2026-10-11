-- A bed somebody sleeps in can't be switched off or removed, and neither can its room.
-- The app checks this too; the triggers keep direct API calls honest.

create or replace function private.place_has_active_stay(place uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stay_places sp
    join public.stays st on st.id = sp.stay_id
    where sp.place_id = place and st.status = 'active'
  );
$$;

create or replace function private.guard_occupied_place()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if ((new.status <> 'available' and old.status = 'available') or (new.is_archived and not old.is_archived))
     and private.place_has_active_stay(new.id) then
    raise exception 'Bed % is occupied', old.number using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guard_occupied_place
before update of status, is_archived on public.places
for each row execute function private.guard_occupied_place();

create or replace function private.guard_occupied_room()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_archived and not old.is_archived
     and exists (select 1 from public.places p where p.room_id = new.id and private.place_has_active_stay(p.id)) then
    raise exception 'Room % has residents', old.number using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guard_occupied_room
before update of is_archived on public.rooms
for each row execute function private.guard_occupied_room();
