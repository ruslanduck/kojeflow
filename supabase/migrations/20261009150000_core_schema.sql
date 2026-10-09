-- Kojeflow core schema: properties -> rooms -> places (beds), tenants, stays (check-ins).
-- Replaces Airtable tables Hostels / Rooms / Places / Tenants / Booking.
-- Computed Airtable fields (capacity, occupied, free, booked man/woman, max price) are views here, not columns.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- properties (Airtable: Hostels)
-- ---------------------------------------------------------------------------
create table public.properties (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null unique,
  legacy_number           integer unique,            -- Airtable "hostel id"
  address                 text,
  city                    text,
  lat                     double precision,
  lon                     double precision,
  commandant_name         text,
  commandant_phone        text,
  is_active               boolean not null default true,   -- Airtable "show"
  is_hidden               boolean not null default false,  -- Airtable "hide"
  restrict_registrations  boolean not null default false,
  airtable_id             text unique,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rooms (Airtable: Rooms)
-- ---------------------------------------------------------------------------
create table public.rooms (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references public.properties (id) on delete restrict,
  number                text not null,                   -- '7', '3A'
  type                  text not null check (type in ('room', 'apartment', 'trailer')),   -- Кімната / Квартира / Вагончик
  status                text not null default 'available' check (status in ('available', 'unavailable')),
  gender                text check (gender in ('male', 'female', 'family')),              -- Ч / Ж / СП
  internal_price        numeric(10, 2),                  -- per bed per night
  external_price        numeric(10, 2),
  internal_price_month  numeric(10, 2),                  -- per month (apartments)
  external_price_month  numeric(10, 2),
  airtable_id           text unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (property_id, type, number)
);

create index rooms_property_id_idx on public.rooms (property_id);

-- ---------------------------------------------------------------------------
-- places = beds (Airtable: Places)
-- ---------------------------------------------------------------------------
create table public.places (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms (id) on delete restrict,
  number          integer not null,
  status          text not null default 'available' check (status in ('available', 'unavailable')),
  internal_price  numeric(10, 2),          -- bed-level price, overrides the room price
  external_price  numeric(10, 2),
  is_archived     boolean not null default false,
  airtable_id     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (room_id, number)
);

create index places_room_id_idx on public.places (room_id);

-- ---------------------------------------------------------------------------
-- tenants = residents (Airtable: Tenants)
-- ---------------------------------------------------------------------------
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  phone         text,
  gender        text check (gender in ('male', 'female')),
  birth_date    date,
  type          text not null default 'unknown' check (type in ('internal', 'commercial', 'unknown')),
  external_id   text,                    -- id from the old system (uuid or 16-digit), not unique
  source        text not null default 'app'
                check (source in ('app', 'airtable_tenants', 'airtable_booking', 'airtable_places')),
  needs_review  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index tenants_external_id_idx on public.tenants (external_id);
create index tenants_full_name_idx on public.tenants (lower(full_name));

-- ---------------------------------------------------------------------------
-- stays = check-ins (Airtable: Booking). One stay can take several beds.
-- ---------------------------------------------------------------------------
create table public.stays (
  id                           uuid primary key default gen_random_uuid(),
  tenant_id                    uuid not null references public.tenants (id) on delete restrict,
  status                       text not null default 'active'
                               check (status in ('active', 'checked_out', 'relocated', 'cancelled')),
  check_in_date                date not null,
  original_check_in_date       date,
  check_out_date               date,
  price_type                   text check (price_type in ('internal', 'commercial')),
  internal_price               numeric(10, 2),
  external_price               numeric(10, 2),
  manager_name                 text,
  responsible_name             text,
  project_name                 text,
  job_manager_name             text,
  payer_external_id            text,
  note                         text,
  check_in_date_inferred       boolean not null default false,
  needs_review                 boolean not null default false,
  source                       text not null default 'app'
                               check (source in ('app', 'airtable_booking', 'airtable_places')),
  legacy_log                   text,
  legacy_prev_booking_id       text,
  legacy_relocated_booking_id  text,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  check (check_out_date is null or check_out_date >= check_in_date)
);

create index stays_tenant_id_idx on public.stays (tenant_id);
create index stays_active_idx on public.stays (status) where status = 'active';

create table public.stay_places (
  stay_id   uuid not null references public.stays (id) on delete cascade,
  place_id  uuid not null references public.places (id) on delete restrict,
  primary key (stay_id, place_id)
);

create index stay_places_place_id_idx on public.stay_places (place_id);

-- A bed can belong to only one active stay.
create or replace function public.assert_place_free()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.stays s
    where s.id = new.stay_id and s.status = 'active'
  ) and exists (
    select 1
    from public.stay_places sp
    join public.stays s on s.id = sp.stay_id
    where sp.place_id = new.place_id
      and sp.stay_id <> new.stay_id
      and s.status = 'active'
  ) then
    raise exception 'place % already has an active stay', new.place_id
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

create trigger stay_places_assert_place_free
  before insert or update on public.stay_places
  for each row execute function public.assert_place_free();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
create trigger rooms_set_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();
create trigger places_set_updated_at before update on public.places
  for each row execute function public.set_updated_at();
create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger stays_set_updated_at before update on public.stays
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- views: current occupancy (replaces Airtable rollups)
-- ---------------------------------------------------------------------------
create view public.place_occupancy
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
  s.check_in_date
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

create view public.room_occupancy
with (security_invoker = true)
as
select
  r.id as room_id,
  r.property_id,
  count(po.place_id) filter (where po.place_status = 'available')                as capacity,
  count(po.stay_id)                                                              as occupied,
  count(po.place_id) filter (where po.place_status = 'available' and po.stay_id is null) as free
from public.rooms r
left join public.place_occupancy po on po.room_id = r.id
group by r.id, r.property_id;

-- ---------------------------------------------------------------------------
-- RLS: deny by default. Server code uses the service role until auth policies land.
-- ---------------------------------------------------------------------------
alter table public.properties  enable row level security;
alter table public.rooms       enable row level security;
alter table public.places      enable row level security;
alter table public.tenants     enable row level security;
alter table public.stays       enable row level security;
alter table public.stay_places enable row level security;

-- ---------------------------------------------------------------------------
-- legacy: raw Airtable rows, kept as-is (not exposed through the Data API)
-- ---------------------------------------------------------------------------
create schema if not exists legacy;
revoke all on schema legacy from public, anon, authenticated;

create table legacy.airtable_rows (
  source_table  text not null,           -- 'Hostels', 'Rooms', 'Places', 'Booking', 'Tenants'
  row_no        integer not null,        -- 1-based row number in the CSV export
  airtable_id   text,
  data          jsonb not null,
  imported_at   timestamptz not null default now(),
  primary key (source_table, row_no)
);

alter table legacy.airtable_rows enable row level security;
