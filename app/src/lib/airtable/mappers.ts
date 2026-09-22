import type {
  Bed, BedStatus, Booking, BookingStatus, Property, Registration, RegistrationStatus,
  Resident, ResidentDocument, Room, RoomType, Stay, StayType, Transfer, User,
} from '@/domain/types';
import type { AirtableRecord } from './client';

/* ------------------------------------------------------------------ accessors */

function text(record: AirtableRecord, field: string): string {
  const value = record.fields[field];
  if (value == null) return '';
  return typeof value === 'string' ? value.trim() : String(value);
}

function num(record: AirtableRecord, field: string): number {
  const value = record.fields[field];
  if (typeof value === 'number') return value;
  // Rollups can arrive as a single-element array; text fields holding digits are common.
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0];
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(record: AirtableRecord, field: string): boolean {
  return record.fields[field] === true;
}

/** Linked-record fields come back from REST as plain arrays of `rec…` ids. */
function links(record: AirtableRecord, field: string): string[] {
  const value = record.fields[field];
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === 'string' ? entry : String((entry as { id?: string })?.id ?? ''))).filter(Boolean);
}

function link(record: AirtableRecord, field: string): string {
  return links(record, field)[0] ?? '';
}

/** Lookups return arrays even when a single value is expected. */
function lookupText(record: AirtableRecord, field: string): string {
  const value = record.fields[field];
  if (Array.isArray(value)) return value.length ? String(value[0]).trim() : '';
  return value == null ? '' : String(value).trim();
}

function isoDate(record: AirtableRecord, field: string): string | null {
  const value = text(record, field);
  return value ? value.slice(0, 10) : null;
}

function attachments(record: AirtableRecord, field: string): ResidentDocument[] {
  const value = record.fields[field];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => entry as { filename?: string; url?: string })
    .filter((entry) => entry?.url)
    .map((entry) => ({ name: entry.filename ?? 'document', url: entry.url as string }));
}

/**
 * Several Ukrainian choice values in this base exist twice, differing only by a
 * Cyrillic `і` versus a Latin `i` (Residences' two "Відхилена" options, Booking's
 * formula outputs). Folding them together is the only way a status check matches
 * both spellings.
 */
function foldLatinLookalikes(value: string): string {
  return value.toLowerCase().replace(/i/g, 'і');
}

function matches(value: string, expected: string): boolean {
  return foldLatinLookalikes(value) === foldLatinLookalikes(expected);
}

/* -------------------------------------------------------------------- mappers */

export function mapProperty(record: AirtableRecord): Property {
  return {
    id: record.id,
    name: text(record, 'hostel') || text(record, 'hostel name'),
    price: num(record, 'min_intPrice'),
    registrations: num(record, 'numberOfRegistrations'),
    registrationsCapacity: num(record, 'MAXnumberOfRegistrations'),
    balance: num(record, 'balance'),
    // No source in the base at all — flagged as unmapped rather than invented.
    inProcess: 0,
    bookedMale: num(record, 'booked man'),
    bookedFemale: num(record, 'booked woman'),
    bookedMixed: num(record, 'booked family'),
  };
}

const ROOM_TYPE: Record<string, RoomType> = {
  'кімната': 'Room',
  'квартира': 'Apartment',
  'вагончик': 'Wagon',
};

export function mapRoom(record: AirtableRecord): Room {
  return {
    id: record.id,
    propertyId: link(record, 'hostel rel'),
    name: text(record, 'room') || `Room ${num(record, 'room number')}`,
    type: ROOM_TYPE[text(record, 'type').toLowerCase()] ?? 'Room',
    priceFrom: num(record, 'internal price'),
    priceTo: num(record, 'external price'),
  };
}

/**
 * Places stores only available/unavailable. Occupied and booked are not stored
 * anywhere — `applyOccupancy` derives them from the stays that point at the place.
 */
export function mapBed(record: AirtableRecord, roomToProperty: Map<string, string>): Bed {
  const roomId = link(record, 'Room');
  const available = !matches(text(record, 'status'), 'Недоступне');
  const tenantId = link(record, 'Tenants');

  return {
    id: record.id,
    roomId,
    // Places has no link to Hostels; the lookup through Room is the only key,
    // and the room map is the fallback when that lookup is empty.
    propertyId: lookupText(record, 'hostel_recID') || roomToProperty.get(roomId) || '',
    index: num(record, 'Place number'),
    status: available ? 'free' : 'unavailable',
    residentId: tenantId || null,
  };
}

export function mapResident(record: AirtableRecord): Resident {
  const gender = text(record, 'gender');
  return {
    id: record.id,
    name: text(record, 'name') || text(record, 'name_inp'),
    gender: matches(gender, 'Жінка') ? 'F' : 'M',
    phone: text(record, 'phone') || undefined,
    dob: isoDate(record, 'birthday') ?? undefined,
    passportDocs: attachments(record, 'passport_file'),
  };
}

/** Internal/Commercial lives on the tenant in Airtable, never on the stay itself. */
export function tenantStayType(record: AirtableRecord | undefined): StayType {
  if (!record) return 'Internal';
  const type = text(record, 'type');
  return matches(type, 'Зовнішній') || matches(type, 'Комерційний') ? 'Commercial' : 'Internal';
}

export function mapStay(record: AirtableRecord, type: StayType, bedToRoom: Map<string, string>): Stay {
  const bedId = link(record, 'Places');
  const checkOut = isoDate(record, 'end date');
  // Airtable has two formula fields both called a status: "activity status" is about
  // the person (Активнi/Виселенi), "status" is about the place (Зайнято/Вільно).
  const activity = text(record, 'activity status');
  const checkedOut = activity ? matches(activity, 'Виселені') : Boolean(checkOut);

  return {
    id: record.id,
    residentId: link(record, 'tenant'),
    residentName: text(record, 'tenant name'),
    propertyId: link(record, 'hostel rel'),
    // `room rels` is a lookup through Places rather than a link, so the room is
    // resolved from the place itself — the same answer by a reliable route.
    roomId: bedToRoom.get(bedId) ?? '',
    bedId,
    type,
    manager: text(record, 'manger'),
    project: text(record, 'projectName'),
    checkIn: isoDate(record, 'start date') ?? '',
    checkOut,
    status: checkedOut ? 'checked-out' : 'active',
    rate: num(record, 'price per day'),
    paidTotal: num(record, 'paid'),
    debt: num(record, 'debt'),
  };
}

const BOOKING_STATUS: { airtable: string; app: BookingStatus }[] = [
  { airtable: 'Новий', app: 'New' },
  { airtable: 'Заселен', app: 'Checked-in' },
  { airtable: 'Скасовано', app: 'Cancelled' },
];

export function mapBooking(record: AirtableRecord, type: StayType): Booking {
  const status = text(record, 'status');
  const discount = num(record, 'discount');

  return {
    id: record.id,
    residentName: text(record, 'tenant name'),
    type,
    propertyId: link(record, 'hostel'),
    date: isoDate(record, 'start date') ?? '',
    comment: text(record, 'note') || text(record, 'comment'),
    by: text(record, 'creator'),
    status: BOOKING_STATUS.find((s) => matches(status, s.airtable))?.app ?? 'New',
    manager: text(record, 'manager'),
    // Requests has no project field; it would have to come through the tenant.
    project: '',
    payer: link(record, 'payer'),
    family: bool(record, 'family'),
    discount: discount ? String(discount) : null,
  };
}

/** Airtable only has the system creation timestamp; our model wants dd/mm/yyyy hh:mm. */
function formatTransferDate(iso: string): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(at.getUTCDate())}/${pad(at.getUTCMonth() + 1)}/${at.getUTCFullYear()} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
}

export function mapTransfer(record: AirtableRecord): Transfer {
  const status = text(record, 'status');
  return {
    id: record.id,
    propertyId: link(record, 'Hostels'),
    by: text(record, 'sender'),
    // "reciever" is misspelled in Airtable; which of the two is the real recipient
    // is an open question, so courier wins and reciever is the fallback.
    to: text(record, 'courier') || text(record, 'reciever'),
    amount: num(record, 'sum'),
    date: formatTransferDate(text(record, 'created')),
    status: matches(status, 'Отримано') ? 'Accepted' : 'Handed over',
  };
}

const REGISTRATION_STATUS: { airtable: string; app: RegistrationStatus }[] = [
  { airtable: 'Нова', app: 'New' },
  { airtable: 'Оформлена', app: 'Registered' },
  { airtable: 'Завершена', app: 'Expired' },
  { airtable: 'Відхилена', app: 'Cancelled' },
];

export function mapRegistration(record: AirtableRecord): Registration {
  const status = text(record, 'status');
  const fileNames = text(record, 'fileNames') || text(record, 'files');

  return {
    id: record.id,
    residentName: text(record, 'name'),
    type: matches(text(record, 'type'), 'Платна') ? 'Paid' : 'Free',
    status: REGISTRATION_STATUS.find((s) => matches(status, s.airtable))?.app ?? 'New',
    propertyId: link(record, 'Hostel'),
    coordinator: text(record, 'creator') || text(record, 'visa_manager_name'),
    issued: isoDate(record, 'start_date') ?? '',
    expires: isoDate(record, 'expiration_date') ?? '',
    // Plain text in Airtable, not attachments — counting separators is a guess.
    docs: fileNames ? fileNames.split(',').filter((name) => name.trim()).length : 0,
  };
}

export function mapUser(record: AirtableRecord): User {
  return {
    id: record.id,
    name: text(record, 'Full name'),
    email: text(record, 'Email'),
    role: text(record, 'Role'),
  };
}

/**
 * Fills in the two bed states Airtable never stores. A place holding an active stay
 * is occupied; everything else keeps whatever available/unavailable said.
 *
 * Nothing maps to `booked`: in Airtable a request reserves a hostel, not a specific
 * place, so that state cannot be derived at bed level.
 */
export function applyOccupancy(beds: Bed[], stays: Stay[]): Bed[] {
  const occupantByBed = new Map<string, string>();
  for (const stay of stays) {
    if (stay.status === 'active' && stay.bedId) occupantByBed.set(stay.bedId, stay.residentId);
  }

  return beds.map((bed) => {
    const occupant = occupantByBed.get(bed.id);
    if (!occupant) return bed;
    return { ...bed, status: 'occupied' as BedStatus, residentId: occupant };
  });
}
