-- Full Kojeflow model on top of core_schema: every entity the app reads (see kojeflow-dev /integration),
-- plus app-only features that never existed in Airtable (payments, floor plans, documents, profiles).
-- Data is reloaded from the Airtable API dump, so CSV-era columns are replaced rather than kept.

-- the occupancy views select from stays; rebuilt at the end with explicit columns
drop view public.room_occupancy;
drop view public.place_occupancy;

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
alter table public.properties
  add column registrations_capacity integer,                 -- MAXnumberOfRegistrations
  add column show_registrations     boolean not null default false,
  add column is_commercial          boolean not null default false,
  add column map_link               text,
  add column guid                   text,                    -- id in 1C
  add column commandant_tg_id       bigint;

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
alter table public.tenants drop constraint tenants_type_check;
alter table public.tenants
  add constraint tenants_type_check check (type in ('internal', 'commercial', 'refugee', 'unknown'));
alter table public.tenants drop constraint tenants_source_check;
alter table public.tenants
  add constraint tenants_source_check check (source in ('app', 'airtable', 'airtable_booking'));
alter table public.tenants
  add column airtable_id        text unique,
  add column passport_number    text,
  add column citizenship        text,
  add column foreign_address    text,
  add column project_name       text,
  add column field_manager_name text,
  add column job_manager_name   text,
  add column job                text,
  add column is_blacklisted     boolean not null default false,
  add column blacklist_comment  text,
  add column avatar_path        text;                         -- storage: tenant-documents

-- ---------------------------------------------------------------------------
-- bookings = reservations to a property, not to a bed (Airtable: Requests)
-- ---------------------------------------------------------------------------
create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  property_id          uuid not null references public.properties (id) on delete restrict,
  room_id              uuid references public.rooms (id) on delete set null,      -- "book the entire room"
  tenant_id            uuid references public.tenants (id) on delete set null,
  payer_tenant_id      uuid references public.tenants (id) on delete set null,
  tenant_name          text,
  tenant_phone         text,
  tenant_gender        text check (tenant_gender in ('male', 'female')),
  start_date           date not null,
  status               text not null default 'new' check (status in ('new', 'checked_in', 'cancelled')),
  price_type           text check (price_type in ('internal', 'commercial', 'refugee')),
  discount             numeric(10, 2),
  discount_percent     numeric(6, 2),
  booked_places        integer,
  is_family            boolean not null default false,
  registration_needed  boolean not null default false,
  manager_name         text,
  manager_project      text,
  responsible_name     text,
  creator_name         text,
  customer             text,
  length_of_stay       text,
  children             text,
  note                 text,
  comment              text,
  legacy_log           text,
  airtable_id          text unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index bookings_property_id_idx on public.bookings (property_id);
create index bookings_tenant_id_idx on public.bookings (tenant_id);
create index bookings_new_idx on public.bookings (start_date) where status = 'new';

-- ---------------------------------------------------------------------------
-- stays (Airtable: Booking) — now the full history, keyed by Airtable record id
-- ---------------------------------------------------------------------------
alter table public.stays drop constraint stays_price_type_check;
alter table public.stays
  add constraint stays_price_type_check check (price_type in ('internal', 'commercial', 'refugee'));
alter table public.stays drop constraint stays_source_check;
alter table public.stays add constraint stays_source_check check (source in ('app', 'airtable'));
alter table public.stays
  drop column payer_external_id,
  drop column legacy_prev_booking_id,
  drop column legacy_relocated_booking_id,
  add column property_id              uuid references public.properties (id) on delete restrict,
  add column booking_id               uuid references public.bookings (id) on delete set null,
  add column payer_tenant_id          uuid references public.tenants (id) on delete set null,
  add column prev_stay_id             uuid references public.stays (id) on delete set null,
  add column relocated_to_stay_id     uuid references public.stays (id) on delete set null,
  add column price_per_day            numeric(10, 2),
  add column discount                 numeric(10, 2),
  add column customer                 text,
  add column second_tenant_name       text,
  add column registration_needed      boolean not null default false,
  add column legacy_paid_total        numeric(12, 2),        -- Airtable kept only running totals
  add column legacy_debt              numeric(12, 2),
  add column legacy_overpaid          numeric(12, 2),
  add column legacy_payments_count    integer,
  add column airtable_id              text unique;

create index stays_property_id_idx on public.stays (property_id);
create index stays_booking_id_idx on public.stays (booking_id);

-- ---------------------------------------------------------------------------
-- registrations = address registrations for visas (Airtable: Residences)
-- ---------------------------------------------------------------------------
create table public.registrations (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid references public.tenants (id) on delete set null,
  property_id              uuid references public.properties (id) on delete set null,
  booking_id               uuid references public.bookings (id) on delete set null,
  full_name                text not null,
  type                     text check (type in ('free', 'paid')),
  status                   text not null default 'new' check (status in ('new', 'registered', 'expired', 'rejected')),
  purpose                  text,
  start_date               date,
  expiration_date          date,
  paid_start_date          date,
  update_date              date,
  project_name             text,
  creator_name             text,
  creator_role             text,
  visa_manager_name        text,
  last_status_modified_by  text,
  is_prolonged             boolean not null default false,
  is_moved                 boolean not null default false,
  passport_number          text,
  visa_number              text,
  citizenship              text,
  origin_address           text,
  residence_permit_code    text,
  employer_company         text,
  employment_period        text,
  hours_for_2_months       numeric(8, 2),
  files                    text,
  file_names               text,
  comment                  text,
  airtable_id              text unique,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index registrations_tenant_id_idx on public.registrations (tenant_id);
create index registrations_property_id_idx on public.registrations (property_id);
create index registrations_expiration_idx on public.registrations (expiration_date) where status = 'registered';

-- ---------------------------------------------------------------------------
-- money_transfers = cash handovers from a property (Airtable: Money transfer)
-- ---------------------------------------------------------------------------
create table public.money_transfers (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid references public.properties (id) on delete restrict,
  sender_name         text,
  courier_name        text,
  receiver_name       text,
  amount              numeric(12, 2) not null,
  status              text not null default 'handed_over' check (status in ('handed_over', 'received')),
  created_via_eworks  boolean not null default false,
  airtable_id         text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index money_transfers_property_id_idx on public.money_transfers (property_id);

-- ---------------------------------------------------------------------------
-- app users: profiles on top of Supabase Auth
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  email        text,
  role         text not null default 'client'
               check (role in ('admin', 'team_member', 'house_manager', 'client')),
  language     text not null default 'uk' check (language in ('uk', 'en')),
  avatar_path  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- properties a house manager (or a client) is limited to
create table public.profile_properties (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  property_id  uuid not null references public.properties (id) on delete cascade,
  primary key (profile_id, property_id)
);

-- ---------------------------------------------------------------------------
-- payments (app-only: Airtable never stored individual transactions)
-- ---------------------------------------------------------------------------
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  stay_id      uuid not null references public.stays (id) on delete restrict,
  tenant_id    uuid references public.tenants (id) on delete set null,
  place_id     uuid references public.places (id) on delete set null,
  property_id  uuid references public.properties (id) on delete set null,
  amount       numeric(12, 2) not null check (amount <> 0),
  paid_at      timestamptz not null default now(),
  proof_path   text,                                   -- storage: payment-proofs
  note         text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index payments_stay_id_idx on public.payments (stay_id);
create index payments_tenant_id_idx on public.payments (tenant_id);

-- ---------------------------------------------------------------------------
-- tenant documents (passport scans, other documents)
-- ---------------------------------------------------------------------------
create table public.tenant_documents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  kind          text not null check (kind in ('passport', 'other')),
  storage_path  text not null,                         -- storage: tenant-documents
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index tenant_documents_tenant_id_idx on public.tenant_documents (tenant_id);

-- ---------------------------------------------------------------------------
-- interactive floor plans (app-only)
-- ---------------------------------------------------------------------------
create table public.floor_plans (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  name          text not null,
  sort_order    integer not null default 0,
  image_path    text not null,                         -- storage: floor-plans
  image_width   integer,
  image_height  integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index floor_plans_property_id_idx on public.floor_plans (property_id, sort_order);

-- zone rectangle in percent of the image; a room sits on one plan at most
create table public.floor_zones (
  id       uuid primary key default gen_random_uuid(),
  plan_id  uuid not null references public.floor_plans (id) on delete cascade,
  room_id  uuid not null unique references public.rooms (id) on delete cascade,
  x        numeric(6, 3) not null check (x between 0 and 100),
  y        numeric(6, 3) not null check (y between 0 and 100),
  w        numeric(6, 3) not null check (w > 0 and w <= 100),
  h        numeric(6, 3) not null check (h > 0 and h <= 100)
);

create index floor_zones_plan_id_idx on public.floor_zones (plan_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
create trigger registrations_set_updated_at before update on public.registrations
  for each row execute function public.set_updated_at();
create trigger money_transfers_set_updated_at before update on public.money_transfers
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger floor_plans_set_updated_at before update on public.floor_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- occupancy views
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
  s.check_in_date,
  r.is_roof       as room_is_roof
from public.places p
join public.rooms r on r.id = p.room_id
left join lateral (
  select st.id, st.tenant_id, st.check_in_date
  from public.stay_places sp
  join public.stays st on st.id = sp.stay_id
  where sp.place_id = p.id and st.status = 'active'
  limit 1
) s on true
left join public.tenants t on t.id = s.tenant_id
where not p.is_archived;

-- an unavailable room offers no beds, same as Airtable's capacity formula
create view public.room_occupancy
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

-- ---------------------------------------------------------------------------
-- RLS: deny by default until auth policies land
-- ---------------------------------------------------------------------------
alter table public.bookings           enable row level security;
alter table public.registrations      enable row level security;
alter table public.money_transfers    enable row level security;
alter table public.profiles           enable row level security;
alter table public.profile_properties enable row level security;
alter table public.payments           enable row level security;
alter table public.tenant_documents   enable row level security;
alter table public.floor_plans        enable row level security;
alter table public.floor_zones        enable row level security;

-- ---------------------------------------------------------------------------
-- private storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tenant-documents', 'tenant-documents', false),
       ('payment-proofs',   'payment-proofs',   false),
       ('floor-plans',      'floor-plans',      false)
on conflict (id) do nothing;
