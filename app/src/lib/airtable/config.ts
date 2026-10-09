/**
 * Airtable base "Work Hotel" — the production base this app reads from.
 *
 * Terminology is mirrored between the two models and this is the single most
 * common source of confusion: our `Booking` (a request made before someone moves
 * in) is Airtable's `Requests`, and our `Stay` (an actual occupancy) is Airtable's
 * `Booking`. The TABLES map is authored from our side — read it as
 * "our entity -> their table".
 */
export const DEFAULT_BASE_ID = 'appB8CoTWVtmH4hbK';

export const TABLES = {
  properties: { id: 'tblgh3XkxVmIVfc5s', name: 'Hostels' },
  rooms: { id: 'tblk7znRtI5afDojW', name: 'Rooms' },
  beds: { id: 'tbld3EYDyrLeuGzRY', name: 'Places' },
  residents: { id: 'tblMvKDL0sxD0isUk', name: 'Tenants' },
  bookings: { id: 'tblvUgZMm4zDIFjqm', name: 'Requests' },
  stays: { id: 'tbl5Smus9L4lLsgFI', name: 'Booking' },
  transfers: { id: 'tblihOo96nRykOE7i', name: 'Money transfer' },
  registrations: { id: 'tblmSS0kUzjIbwhBV', name: 'Residences' },
  users: { id: 'tbl2UgeoK7bVwslvv', name: 'App users' },
} as const;

export type TableKey = keyof typeof TABLES;

/**
 * Live row counts measured against the base, recorded so the diagnostics page can
 * show fetched-vs-total and so nobody reintroduces a full scan of the big two.
 * Tenants (~33k) and Booking (~13k) are never fetched wholesale.
 */
export const APPROX_TOTALS: Record<TableKey, number> = {
  properties: 26,
  rooms: 304,
  beds: 852,
  residents: 32882,
  bookings: 5904,
  stays: 13418,
  transfers: 227,
  registrations: 1365,
  users: 39,
};

/** Hard ceilings for the demo pull, in records. */
export const FETCH_LIMITS: Record<TableKey, number> = {
  properties: 100,
  rooms: 500,
  beds: 1200,
  residents: 4000,
  bookings: 800,
  stays: 2500,
  transfers: 400,
  registrations: 1500,
  users: 100,
};

/** A closed stay/request older than this is out of scope for the demo. */
export const LOOKBACK_DAYS = 120;

/**
 * Only the fields each mapper actually reads. Projecting keeps payloads small on
 * tables that carry 100-229 columns, and makes a renamed field fail loudly instead
 * of silently arriving as undefined.
 *
 * Two names are misspelled in Airtable itself and must stay misspelled here:
 * Places' `inernal price` and Booking's `manger`.
 */
export const FIELDS: Record<TableKey, string[]> = {
  properties: [
    'hostel', 'hostel name', 'hostel id', 'min_intPrice', 'max_intPrice',
    'numberOfRegistrations', 'MAXnumberOfRegistrations', 'balance',
    'booked man', 'booked woman', 'booked family',
  ],
  rooms: ['hostel rel', 'room', 'room number', 'type', 'internal price', 'external price', 'status', 'capacity'],
  beds: ['Place', 'Room', 'hostel_recID', 'hostel name', 'Place number', 'status', 'Tenants', 'inernal price', 'external price'],
  residents: ['name_inp', 'name', 'gender', 'phone', 'birthday', 'passport', 'passport_file', 'type', 'black_list'],
  bookings: [
    'tenant', 'tenant name', 'hostel', 'start date', 'note', 'comment', 'creator',
    'status', 'manager', 'payer', 'family', 'discount', 'discount_percentage',
  ],
  stays: [
    'tenant', 'tenant name', 'hostel rel', 'room rels', 'Places', 'manger', 'projectName',
    'start date', 'end date', 'status', 'activity status', 'status_booking',
    'price per day', 'paid', 'debt',
  ],
  transfers: ['Hostels', 'hostel', 'sender', 'courier', 'reciever', 'sum', 'created', 'status'],
  registrations: [
    'Tenant', 'name', 'type', 'status', 'Hostel', 'creator', 'visa_manager_name',
    'start_date', 'expiration_date', 'files', 'fileNames',
  ],
  users: ['Full name', 'Email', 'Role', 'Hostel', 'Status'],
};

export interface AirtableEnv {
  token: string;
  baseId: string;
}

/**
 * Null when no token is configured — the caller then falls back to the committed
 * snapshot rather than failing, which keeps the app runnable where api.airtable.com
 * is unreachable.
 */
export function readAirtableEnv(): AirtableEnv | null {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!token) return null;
  return { token, baseId: process.env.AIRTABLE_BASE_ID?.trim() || DEFAULT_BASE_ID };
}
