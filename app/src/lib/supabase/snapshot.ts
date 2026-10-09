import type { CurrentUser, EntityBundle, SnapshotPayload, TableStat } from '@/domain/snapshot';
import type {
  Bed, Booking, BookingStatus, FloorPlan, FloorZone, Payment, Property, Registration, RegistrationStatus,
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
// Room names keep the Airtable spelling ("Korycany - Кімната 14"), which the team reads every day.
const ROOM_TYPE_LABEL: Record<string, string> = { room: 'Кімната', apartment: 'Квартира', trailer: 'Вагончик' };

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

function stayType(priceType: unknown, tenantType: unknown): StayType {
  if (priceType) return priceType === 'commercial' ? 'Commercial' : 'Internal';
  return tenantType === 'commercial' ? 'Commercial' : 'Internal';
}

export function toPayload(raw: RawSnapshot): SnapshotPayload {
  const entities: EntityBundle = {
    properties: [], rooms: [], beds: [], residents: [], stays: [], bookings: [],
    payments: [], transfers: [], registrations: [], users: [], floorPlans: [], floorZones: [],
  };

  // ---- properties
  entities.properties = raw.properties.map((p): Property => ({
    id: str(p.id),
    name: str(p.name),
    price: num(p.min_internal_price),
    registrations: num(p.registered),
    registrationsCapacity: num(p.registrations_capacity),
    // Airtable's own definition: everything paid in minus what was handed over and received.
    balance: num(p.paid_total) - num(p.received_total),
    inProcess: 0,
    bookedMale: num(p.booked_male),
    bookedFemale: num(p.booked_female),
    bookedMixed: num(p.booked_family),
  }));
  const propertyName = new Map(entities.properties.map((p) => [p.id, p.name]));

  // ---- rooms
  entities.rooms = raw.rooms.map((r): Room => {
    const type = str(r.type);
    const roof = r.is_roof ? ' - дах' : '';
    return {
      id: str(r.id),
      propertyId: str(r.property_id),
      name: `${propertyName.get(str(r.property_id)) ?? ''} - ${ROOM_TYPE_LABEL[type] ?? type} ${str(r.number)}${roof}`,
      type: ROOM_TYPE[type] ?? 'Room',
      priceFrom: num(r.internal_price),
      priceTo: num(r.external_price),
    };
  });
  const roomProperty = new Map(entities.rooms.map((r) => [r.id, r.propertyId]));

  // ---- stays and which beds they hold
  const tenantsById = new Map(raw.tenants.map((t) => [str(t.id), t]));
  const placesById = new Map(raw.places.map((pl) => [str(pl.id), pl]));
  const bedsOfStay = new Map<string, string[]>();
  for (const sp of raw.stay_places) {
    const list = bedsOfStay.get(str(sp.stay_id)) ?? [];
    list.push(str(sp.place_id));
    bedsOfStay.set(str(sp.stay_id), list);
  }
  const paidByStay = new Map<string, number>();
  for (const pm of raw.payments) paidByStay.set(str(pm.stay_id), (paidByStay.get(str(pm.stay_id)) ?? 0) + num(pm.amount));

  const occupantOfBed = new Map<string, string>();
  entities.stays = raw.stays.map((s): Stay => {
    const id = str(s.id);
    const tenant = tenantsById.get(str(s.tenant_id));
    // A stay can hold several beds; the app's Stay carries one, the rest still show as occupied.
    const beds = (bedsOfStay.get(id) ?? []).sort(
      (a, b) => num(placesById.get(a)?.number) - num(placesById.get(b)?.number),
    );
    const active = s.status === 'active';
    if (active) for (const bed of beds) occupantOfBed.set(bed, str(s.tenant_id));
    const bedId = beds[0] ?? '';
    return {
      id,
      residentId: str(s.tenant_id),
      residentName: str(tenant?.full_name),
      propertyId: str(s.property_id),
      roomId: str(placesById.get(bedId)?.room_id),
      bedId,
      type: stayType(s.price_type, tenant?.type),
      manager: str(s.manager_name),
      project: str(s.project_name),
      checkIn: date(s.check_in_date) ?? '',
      checkOut: date(s.check_out_date),
      status: active ? 'active' : 'checked-out',
      rate: num(s.price_per_day),
      paidTotal: num(s.legacy_paid_total) + (paidByStay.get(id) ?? 0),
      debt: num(s.legacy_debt),
    };
  });

  // ---- beds
  entities.beds = raw.places.map((pl): Bed => {
    const id = str(pl.id);
    const occupant = occupantOfBed.get(id);
    return {
      id,
      roomId: str(pl.room_id),
      propertyId: roomProperty.get(str(pl.room_id)) ?? '',
      index: num(pl.number),
      status: occupant ? 'occupied' : pl.status === 'unavailable' ? 'unavailable' : 'free',
      residentId: occupant ?? null,
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
    // Files live in a private bucket; their signed URLs are issued when a document is opened.
    const asDoc = (d: Row) => ({ name: str(d.file_name) || 'document', url: str(d.storage_path) });
    return {
      id: str(t.id),
      name: str(t.full_name),
      gender: t.gender === 'female' ? 'F' : 'M',
      phone: str(t.phone) || undefined,
      dob: date(t.birth_date) ?? undefined,
      passportDocs: docs.filter((d) => d.kind === 'passport').map(asDoc),
      otherDocs: docs.filter((d) => d.kind === 'other').map(asDoc),
    };
  });

  // ---- bookings
  entities.bookings = raw.bookings.map((b): Booking => {
    const percent = num(b.discount_percent);
    const amount = num(b.discount);
    return {
      id: str(b.id),
      residentName: str(b.tenant_name),
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
      docName: path ? path.split('/').pop() ?? '' : '',
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
    const files = str(g.file_names) || str(g.files);
    return {
      id: str(g.id),
      residentName: str(g.full_name),
      type: g.type === 'paid' ? 'Paid' : 'Free',
      status: REGISTRATION_STATUS[str(g.status)] ?? 'New',
      propertyId: str(g.property_id),
      coordinator: str(g.creator_name) || str(g.visa_manager_name),
      issued: date(g.start_date) ?? '',
      expires: date(g.expiration_date) ?? '',
      docs: files ? files.split(',').filter((name) => name.trim()).length : 0,
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
    imageUrl: str(fp.image_path),
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
