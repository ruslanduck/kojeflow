-- Team management from Settings. Profiles have no write policies (a user must not change their
-- own role), so admins change roles, property assignments and access through these functions,
-- and every user can rename themselves.

create or replace function public.admin_set_profile(
  p_profile uuid,
  p_role text,
  p_active boolean,
  p_property_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.app_role()) is distinct from 'admin' then
    raise exception 'Only an admin can change the team' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'team_member', 'house_manager', 'client') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;
  if p_profile = auth.uid() and (p_role <> 'admin' or not p_active) then
    raise exception 'You cannot take admin rights away from yourself' using errcode = '42501';
  end if;

  update public.profiles set role = p_role, is_active = p_active where id = p_profile;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  delete from public.profile_properties where profile_id = p_profile;
  if p_role in ('house_manager', 'client') then
    insert into public.profile_properties (profile_id, property_id)
    select p_profile, unnest(coalesce(p_property_ids, '{}'));
  end if;
end;
$$;

create or replace function public.set_my_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Name is empty' using errcode = '22023';
  end if;
  update public.profiles set full_name = trim(p_name) where id = auth.uid();
end;
$$;

revoke all on function public.admin_set_profile(uuid, text, boolean, uuid[]) from public, anon;
revoke all on function public.set_my_name(text) from public, anon;
grant execute on function public.admin_set_profile(uuid, text, boolean, uuid[]) to authenticated;
grant execute on function public.set_my_name(text) to authenticated;
