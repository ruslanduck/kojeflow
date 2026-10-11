-- Users can't update their profile directly (that would let them change their role),
-- so the interface language is saved through this one-column function.

create or replace function public.set_my_language(lang text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lang not in ('uk', 'en') then
    raise exception 'Unknown language %', lang using errcode = '22023';
  end if;
  update public.profiles set language = lang where id = auth.uid();
end;
$$;

revoke all on function public.set_my_language(text) from public, anon;
grant execute on function public.set_my_language(text) to authenticated;
