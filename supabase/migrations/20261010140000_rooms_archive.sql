-- Rooms can be removed from the app without losing their stays history: archived, not deleted.
alter table public.rooms add column is_archived boolean not null default false;
