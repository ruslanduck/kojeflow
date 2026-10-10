-- Floor plans persist: admins and team members draw plans and zones; plan images live in the
-- private floor-plans bucket and are served through signed URLs.

create policy "admins and team edit floor plans" on public.floor_plans for all to authenticated
  using ((select private.app_role()) in ('admin', 'team_member'))
  with check ((select private.app_role()) in ('admin', 'team_member'));

create policy "admins and team edit floor zones" on public.floor_zones for all to authenticated
  using ((select private.app_role()) in ('admin', 'team_member'))
  with check ((select private.app_role()) in ('admin', 'team_member'));

create policy "staff read floor plan images" on storage.objects for select to authenticated
  using (bucket_id = 'floor-plans' and (select private.app_role()) is not null);

create policy "admins and team upload floor plan images" on storage.objects for insert to authenticated
  with check (bucket_id = 'floor-plans' and (select private.app_role()) in ('admin', 'team_member'));

create policy "admins and team delete floor plan images" on storage.objects for delete to authenticated
  using (bucket_id = 'floor-plans' and (select private.app_role()) in ('admin', 'team_member'));
