-- Removed beds and rooms keep their rows for history; their numbers become free for new ones.

alter table public.places drop constraint places_room_id_number_key;
create unique index places_room_id_number_key on public.places (room_id, number) where not is_archived;

alter table public.rooms drop constraint rooms_property_id_type_number_is_roof_key;
create unique index rooms_property_id_type_number_is_roof_key on public.rooms (property_id, type, number, is_roof) where not is_archived;
