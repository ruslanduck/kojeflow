import type {
  Booking, Bed, FloorPlan, FloorZone, Payment, Property, Registration, Resident, Room, Stay, Transfer, User,
} from './types';
import type { RoleName } from './roles';
import type { Lang } from '@/i18n';

/** Every entity slice the app renders, as one transferable bundle. */
export interface EntityBundle {
  properties: Property[];
  rooms: Room[];
  beds: Bed[];
  residents: Resident[];
  stays: Stay[];
  bookings: Booking[];
  payments: Payment[];
  transfers: Transfer[];
  registrations: Registration[];
  users: User[];
  floorPlans: FloorPlan[];
  floorZones: FloorZone[];
}

export interface TableStat {
  /** Airtable table name, as it appears in the base. */
  table: string;
  /** Our entity slice it fills. */
  entity: string;
  fetched: number;
  /** Rows the table holds in total, so a capped pull is never read as an empty one. */
  total: number;
  capped: boolean;
}

export interface SnapshotMeta {
  /** 'supabase' is the database; 'live' / 'snapshot' are the retired Airtable feed and its committed capture. */
  source: 'supabase' | 'live' | 'snapshot';
  fetchedAt: string;
  tables: TableStat[];
  /** Non-fatal per-table failures — the rest of the payload is still usable. */
  errors: string[];
}

/** The signed-in user, from their Supabase profile. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  /** Properties a house manager or client is limited to; empty for staff. */
  propertyIds: string[];
  language: Lang;
}

export interface SnapshotPayload {
  entities: EntityBundle;
  meta: SnapshotMeta;
  me?: CurrentUser | null;
}

export function emptyBundle(): EntityBundle {
  return {
    properties: [], rooms: [], beds: [], residents: [], stays: [], bookings: [],
    payments: [], transfers: [], registrations: [], users: [], floorPlans: [], floorZones: [],
  };
}
