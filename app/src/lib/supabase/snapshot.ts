import type { CurrentUser, EntityBundle, SnapshotPayload, TableStat } from '@/domain/snapshot';
import type {
  Bed, Booking, BookingStatus, FloorPlan, FloorZone, Gender, Payment, Property, Registration, RegistrationStatus,
  Resident, Room, RoomType, Stay, StayType, Transfer, User,
} from '@/domain/types';
import type { RoleName } from '@/domain/roles';

/**
 * Maps the JSON returned by public.app_snapshot() (see supabase/migrations) onto the
 * app's entities, so every screen keeps reading the same shapes it read from Airtable.
 */

type Row = Record<string, unknown>;

export interface RawSnapshot {
  properties: Row[];
  rooms: Row[];
  places: Row[];
  stays: Row[];
  stay_places: Row[];
  tenants: Row[];
  tenant_documents: Row[];
  bookings: Row[];
  registrations: Row[];
  transfers: Row[];
  payments: Row[];
  profiles: Row[];
  floor_plans: Row[];
  floor_zones: Row[];
  me: Row | null;
}

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const date = (v: unknown): string | null => (v ? String(v).slice(0, 10) : null);

export const ROLE_BY_DB: Record<string, RoleName> = {
  admin: 'Administrator',
  team_member: 'Company employee',
  house_manager: 'Commandant',
  client: 'Client',
};

const ROOM_TYPE: Record<string, RoomType> = { room: 'Room', apartment: 'Apartment', trailer: 'Wagon' };
export const ROOM_TYPE_DB: Record<RoomType, string> = { Room: 'room', Apartment: 'apartment', Wagon: 'trailer' };
// Room names are kept in English ("Korycany - Room 14") and translated on screen by translatePlace,
// which gives the team's Airtable spelling ("Korycany - Кімната 14") in Ukrainian.
const ROOM_TYPE_LABEL: Record<string, string> = { room: 'Room', apartment: 'Apartment', trailer: 'Wagon' };

/** "Korycany - Room 14", "Kralupy - Room 3 - roof", for rooms loaded and created alike. */
export function roomName(propertyName: string, dbType: string, number: string, isRoof = false): string {
  return `${propertyName} - ${ROOM_TYPE_LABEL[dbType] ?? dbType} ${number}${isRoof ? ' - roof' : ''}`;
}

const BOOKING_STATUS: Record<string, BookingStatus> = { new: 'New', checked_in: 'Checked-in', cancelled: 'Cancelled' };
const REGISTRATION_STATUS: Record<string, RegistrationStatus> = {
  new: 'New', registered: 'Registered', expired: 'Expired', rejected: 'Cancelled',
};

const pragueTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** Transfers display as dd/mm/yyyy hh:mm, local to the properties. */
function transferDate(iso: unknown): string {
  if (!iso) return '';
  const at = new Date(String(iso));
  return Number.isNaN(at.getTime()) ? '' : pragueTime.format(at).replace(',', '');
}

/** Above this a nightly bed price is a data error (Airtable has 210200 where 210 and 200 were glued together). */
const MAX_NIGHTLY_RATE = 5000;

function genderOf(value: unknown): Gender | null {
  return value === 'female' ? 'F' : value === 'male' ? 'M' : null;
}

function stayType(priceType: unknown, tenantType: unknown): StayType {
  if (priceType) return priceType === 'commercial' ? 'Commercial' : 'Internal';
  return tenantType === 'commercial' ? 'Commercial' : 'Internal';
}

export function toPayload(raw: RawSnapshot): SnapshotPayload {
  const entities: EntityBundle = {
    properties: [], rooms: [], beds: [], residents: [], stays: [], bookings: [],
    payments: [], transfers: [], registrations: [], users: [], floorPlans: [], floorZones: [],
  };

  // Properties hidden in Airtable are neither shown nor counted, and neither is anything in them.
  // Registrations keep their address, since they stay legally valid after a property closes.
  const hidden = new Set(raw.properties.filter((p) => p.is_hidden).map((p) => str(p.id)));
  const visible = (propertyId: unknown) => !hidden.has(str(propertyId));
  const allPropertyNames = new Map(raw.properties.map((p) => [str(p.id), str(p.name)]));

  // A property's price range spans the internal bed prices of its available rooms.
  const roomPrices = new Map<string, number[]>();
  for (const r of raw.rooms) {
    if (r.status !== 'available' || num(r.internal_price) <= 0) continue;
    const list = roomPrices.get(str(r.property_id)) ?? [];
    list.push(num(r.internal_price));
    roomPrices.set(str(r.property_id), list);
  }
  // Billing starts from zero in this app, so a balance is what has been paid here.
  const paidByProperty = new Map<string, number>();
  for (const pm of raw.payments) {
    paidByProperty.set(str(pm.property_id), (paidByProperty.get(str(pm.property_id)) ?? 0) + num(pm.amount));
  }

  // ---- properties
  entities.properties = raw.properties.filter((p) => visible(p.id)).map((p): Property => {
    const prices = roomPrices.get(str(p.id)) ?? [];
    return {
      id: str(p.id),
      name: str(p.name),
      price: prices.length ? Math.min(...prices) : 0,
      priceTo: prices.length ? Math.max(...prices) : 0,
      registrations: num(p.registered),
      registrationsCapacity: num(p.registrations_capacity),
      balance: paidByProperty.get(str(p.id)) ?? 0,
      inProcess: 0,
    };
  });
  const propertyName = new Map(entities.properties.map((p) => [p.id, p.name]));

  // ---- rooms
  entities.rooms = raw.rooms.filter((r) => visible(r.property_id) && !r.is_archived).map((r): Room => {
    const type = str(r.type);
    return {
      id: str(r.id),
      propertyId: str(r.property_id),
      name: roomName(propertyName.get(str(r.property_id)) ?? '', type, str(r.number), Boolean(r.is_roof)),
      type: ROOM_TYPE[type] ?? 'Room',
      priceFrom: num(r.internal_price),
      priceTo: num(r.external_price),
      available: r.status === 'available',
    };
  });
  const roomProperty = new Map(entities.rooms.map((r) => [r.id, r.propertyId]));
  const roomAvailable = new Map(entities.rooms.map((r) => [r.id, r.available]));

  // ---- stays and which beds they hold
  const tenantsById = new Map(raw.tenants.map((t) => [str(t.id), t]));
  const placesById = new Map(raw.places.map((pl) => [str(pl.id), pl]));
  const bedsOfStay = new Map<string, string[]>();
  for (const sp of raw.stay_places) {
    const list = bedsOfStay.get(str(sp.stay_id)) ?? [];
    list.push(str(sp.place_id));
    bedsOfStay.set(str(sp.stay_id), list);
  }
  // A bed's own price wins over its room's (Airtable: "overrides the room price").
  const rawRoomsById = new Map(raw.rooms.map((r) => [str(r.id), r]));
  const bedPrice = (placeId: string, type: StayType): number => {
    const pl = placesById.get(placeId);
    const room = rawRoomsById.get(str(pl?.room_id));
    const column = type === 'Commercial' ? 'external_price' : 'internal_price';
    return num(pl?.[column]) || num(room?.[column]);
  };
  const occupantOfBed = new Map<string, string>();
  entities.stays = raw.stays.filter((s) => visible(s.property_id)).map((s): Stay => {
    const id = str(s.id);
    const tenant = tenantsById.get(str(s.tenant_id));
    // A stay can hold several beds; the app's Stay carries one, the rest still show as occupied.
    const beds = (bedsOfStay.get(id) ?? []).sort(
      (a, b) => num(placesById.get(a)?.number) - num(placesById.get(b)?.number),
    );
    const active = s.status === 'active';
    if (active) for (const bed of beds) occupantOfBed.set(bed, str(s.tenant_id));
    const bedId = beds[0] ?? '';
    const type = stayType(s.price_type, tenant?.type);
    const stayRate = num(s.price_per_day);
    const bedsRate = beds.reduce((sum, b) => sum + bedPrice(b, type), 0);
    const rateValid = stayRate > 0 && stayRate <= MAX_NIGHTLY_RATE * Math.max(1, beds.length);
    return {
      id,
      residentId: str(s.tenant_id),
      residentName: str(tenant?.full_name),
      propertyId: str(s.property_id),
      roomId: str(placesById.get(bedId)?.room_id),
      bedId,
      bedIds: beds,
      type,
      manager: str(s.manager_name),
      jobManager: str(s.job_manager_name),
      // Commercial stays name their customer in a column of its own.
      project: str(s.project_name) || str(s.customer),
      checkIn: date(s.check_in_date) ?? '',
      checkOut: date(s.check_out_date),
      status: active ? 'active' : 'checked-out',
      rate: rateValid ? stayRate : bedsRate,
      rateSource: rateValid ? 'stay' : bedsRate > 0 ? 'beds' : 'none',
      // Airtable's running paid/debt totals are deliberately left behind: billing starts from zero.
    };
  });

  // ---- beds (a bed in an unavailable room is unavailable, as in Airtable's capacity formula)
  entities.beds = raw.places.filter((pl) => roomProperty.has(str(pl.room_id))).map((pl): Bed => {
    const id = str(pl.id);
    const occupant = occupantOfBed.get(id);
    const unavailable = pl.status === 'unavailable' || roomAvailable.get(str(pl.room_id)) === false;
    return {
      id,
      roomId: str(pl.room_id),
      propertyId: roomProperty.get(str(pl.room_id)) ?? '',
      index: num(pl.number),
      status: occupant ? 'occupied' : unavailable ? 'unavailable' : 'free',
      residentId: occupant ?? null,
      priceInternal: bedPrice(id, 'Internal'),
      priceExternal: bedPrice(id, 'Commercial'),
    };
  });

  // ---- residents
  const docsByTenant = new Map<string, Row[]>();
  for (const d of raw.tenant_documents) {
    const list = docsByTenant.get(str(d.tenant_id)) ?? [];
    list.push(d);
    docsByTenant.set(str(d.tenant_id), list);
  }
  entities.residents = raw.tenants.map((t): Resident => {
    const docs = docsByTenant.get(str(t.id)) ?? [];
    // Files live in a private bucket; the snapshot route fills in signed URLs.
    const asDoc = (d: Row) => ({ id: str(d.id), path: str(d.storage_path), name: str(d.file_name) || 'document', url: '' });
    return {
      id: str(t.id),
      name: str(t.full_name),
      gender: genderOf(t.gender),
      phone: str(t.phone) || undefined,
      dob: date(t.birth_date) ?? undefined,
      avatarPath: str(t.avatar_path) || undefined,
      passportDocs: docs.filter((d) => d.kind === 'passport').map(asDoc),
      otherDocs: docs.filter((d) => d.kind === 'other').map(asDoc),
    };
  });

  // ---- bookings
  entities.bookings = raw.bookings.filter((b) => visible(b.property_id)).map((b): Booking => {
    const percent = num(b.discount_percent);
    const amount = num(b.discount);
    return {
      id: str(b.id),
      residentId: str(b.tenant_id) || null,
      residentName: str(b.tenant_name),
      gender: genderOf(b.tenant_gender),
      type: stayType(b.price_type, b.tenant_type),
      propertyId: str(b.property_id),
      date: date(b.start_date) ?? '',
      comment: str(b.note) || str(b.comment),
      by: str(b.creator_name),
      status: BOOKING_STATUS[str(b.status)] ?? 'New',
      manager: str(b.manager_name),
      project: str(b.manager_project),
      payer: str(b.payer_name),
      family: Boolean(b.is_family),
      discount: percent ? `${percent}%` : amount ? String(amount) : null,
      phone: str(b.tenant_phone),
      responsible: str(b.responsible_name),
      children: str(b.children),
      registrationNeeded: Boolean(b.registration_needed),
      payerTenantId: str(b.payer_tenant_id) || null,
    };
  });

  // ---- payments, transfers, registrations
  entities.payments = raw.payments.map((pm): Payment => {
    const path = str(pm.proof_path);
    return {
      id: str(pm.id),
      stayId: str(pm.stay_id),
      propertyId: str(pm.property_id),
      amount: num(pm.amount),
      by: str(pm.by),
      at: date(pm.paid_at) ?? '',
      docName: path ? path.split('/').pop()?.replace(/^[0-9a-f-]{36}-/, '') ?? '' : '',
      // Signed by the snapshot route: the bucket is private.
      docUrl: path,
      note: str(pm.note),
    };
  });

  entities.transfers = raw.transfers.map((m): Transfer => ({
    id: str(m.id),
    propertyId: str(m.property_id),
    by: str(m.sender_name),
    to: str(m.courier_name) || str(m.receiver_name),
    amount: num(m.amount),
    date: transferDate(m.created_at),
    status: m.status === 'received' ? 'Accepted' : 'Handed over',
  }));

  entities.registrations = raw.registrations.map((g): Registration => {
    return {
      id: str(g.id),
      residentId: str(g.tenant_id) || null,
      residentName: str(g.full_name),
      type: g.type === 'paid' ? 'Paid' : 'Free',
      status: REGISTRATION_STATUS[str(g.status)] ?? 'New',
      propertyId: str(g.property_id),
      propertyName: allPropertyNames.get(str(g.property_id)) ?? '',
      coordinator: str(g.creator_name) || str(g.visa_manager_name),
      issued: date(g.start_date) ?? '',
      expires: date(g.expiration_date) ?? '',
      docs: num(g.file_count),
    };
  });

  // ---- team, floor plans
  entities.users = raw.profiles.map((u): User => ({
    id: str(u.id),
    name: str(u.full_name),
    email: str(u.email),
    role: ROLE_BY_DB[str(u.role)] ?? 'Client',
  }));

  entities.floorPlans = raw.floor_plans.map((fp): FloorPlan => ({
    id: str(fp.id),
    propertyId: str(fp.property_id),
    name: str(fp.name),
    sort: num(fp.sort_order),
    // Signed by the snapshot route: the bucket is private.
    imageUrl: '',
    imagePath: str(fp.image_path),
    imageWidth: fp.image_width == null ? undefined : num(fp.image_width),
    imageHeight: fp.image_height == null ? undefined : num(fp.image_height),
  }));

  entities.floorZones = raw.floor_zones.map((z): FloorZone => ({
    id: str(z.id),
    planId: str(z.plan_id),
    roomId: str(z.room_id),
    x: num(z.x), y: num(z.y), w: num(z.w), h: num(z.h),
  }));

  const me: CurrentUser | null = raw.me
    ? {
        id: str(raw.me.id),
        name: str(raw.me.full_name),
        email: str(raw.me.email),
        role: ROLE_BY_DB[str(raw.me.role)] ?? 'Client',
        propertyIds: Array.isArray(raw.me.property_ids) ? raw.me.property_ids.map(str) : [],
        language: str(raw.me.language) === 'en' ? 'EN' : 'UK',
        active: raw.me.is_active !== false,
      }
    : null;

  const stat = (table: string, entity: string, fetched: number): TableStat =>
    ({ table, entity, fetched, total: fetched, capped: false });

  return {
    entities,
    me,
    meta: {
      source: 'supabase',
      fetchedAt: new Date().toISOString(),
      tables: [
        stat('properties', 'Property', entities.properties.length),
        stat('rooms', 'Room', entities.rooms.length),
        stat('places', 'Bed', entities.beds.length),
        stat('tenants', 'Resident', entities.residents.length),
        stat('stays', 'Stay', entities.stays.length),
        stat('bookings', 'Booking', entities.bookings.length),
        stat('money_transfers', 'Transfer', entities.transfers.length),
        stat('registrations', 'Registration', entities.registrations.length),
        stat('profiles', 'User', entities.users.length),
      ],
      errors: [],
    },
  };
}
