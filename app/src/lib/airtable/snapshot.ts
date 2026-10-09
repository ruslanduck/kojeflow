import type { EntityBundle, SnapshotPayload, TableStat } from '@/domain/snapshot';
import { emptyBundle } from '@/domain/snapshot';
import { APPROX_TOTALS, FETCH_LIMITS, FIELDS, LOOKBACK_DAYS, TABLES, type AirtableEnv, type TableKey } from './config';
import { fetchByIds, fetchTable, type AirtableRecord } from './client';
import {
  applyOccupancy, mapBed, mapBooking, mapProperty, mapRegistration, mapResident,
  mapRoom, mapStay, mapTransfer, mapUser, tenantStayType,
} from './mappers';

/**
 * Stays and requests are pulled by recency rather than wholesale: Booking holds
 * ~13k rows and Tenants ~33k, which at 100 records per request would take minutes.
 */
const RECENT_STAYS = `OR({end date} = BLANK(), IS_AFTER({end date}, DATEADD(TODAY(), -${LOOKBACK_DAYS}, 'days')))`;
const RECENT_REQUESTS = `IS_AFTER({start date}, DATEADD(TODAY(), -${LOOKBACK_DAYS}, 'days'))`;

function stat(key: TableKey, entity: string, fetched: number): TableStat {
  return {
    table: TABLES[key].name,
    entity,
    fetched,
    total: APPROX_TOTALS[key],
    capped: fetched >= FETCH_LIMITS[key],
  };
}

/**
 * Pulls the demo slice of the base and maps it onto the app's entities.
 *
 * Order matters: rooms before places (places reach their hostel only through a
 * room), stays before tenants (the tenant set is whoever those stays reference),
 * and occupancy last, since it is derived from the mapped stays.
 */
export async function fetchSnapshot(env: AirtableEnv): Promise<SnapshotPayload> {
  const entities = emptyBundle();
  const tables: TableStat[] = [];
  const errors: string[] = [];

  const load = async (key: TableKey, options: { filterByFormula?: string } = {}): Promise<AirtableRecord[]> => {
    try {
      return await fetchTable(env, TABLES[key].id, {
        fields: FIELDS[key],
        maxRecords: FETCH_LIMITS[key],
        ...options,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return [];
    }
  };

  const [propertyRecords, roomRecords, bedRecords] = await Promise.all([
    load('properties'),
    load('rooms'),
    load('beds'),
  ]);

  entities.properties = propertyRecords.map(mapProperty);
  entities.rooms = roomRecords.map(mapRoom);
  const roomToProperty = new Map(entities.rooms.map((room) => [room.id, room.propertyId]));
  const rawBeds = bedRecords.map((record) => mapBed(record, roomToProperty));
  const bedToRoom = new Map(rawBeds.map((bed) => [bed.id, bed.roomId]));

  const [stayRecords, bookingRecords, transferRecords, registrationRecords, userRecords] = await Promise.all([
    load('stays', { filterByFormula: RECENT_STAYS }),
    load('bookings', { filterByFormula: RECENT_REQUESTS }),
    load('transfers'),
    load('registrations'),
    load('users'),
  ]);

  // Only the tenants these stays and requests actually reference — pulling the whole
  // 33k-row table would take ~330 requests for a few hundred useful rows.
  const tenantIds = [
    ...stayRecords.flatMap((record) => (record.fields.tenant as string[] | undefined) ?? []),
    ...bookingRecords.flatMap((record) => (record.fields.tenant as string[] | undefined) ?? []),
  ];

  let tenantRecords: AirtableRecord[] = [];
  try {
    tenantRecords = await fetchByIds(env, TABLES.residents.id, tenantIds, FIELDS.residents);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const tenantsById = new Map(tenantRecords.map((record) => [record.id, record]));
  const stayTypeOf = (record: AirtableRecord) =>
    tenantStayType(tenantsById.get(((record.fields.tenant as string[] | undefined) ?? [])[0] ?? ''));

  entities.residents = tenantRecords.map(mapResident);
  entities.stays = stayRecords.map((record) => mapStay(record, stayTypeOf(record), bedToRoom));
  entities.bookings = bookingRecords.map((record) => mapBooking(record, stayTypeOf(record)));
  entities.transfers = transferRecords.map(mapTransfer);
  entities.registrations = registrationRecords.map(mapRegistration);
  entities.users = userRecords.map(mapUser);
  entities.beds = applyOccupancy(rawBeds, entities.stays);

  tables.push(
    stat('properties', 'Property', propertyRecords.length),
    stat('rooms', 'Room', roomRecords.length),
    stat('beds', 'Bed', bedRecords.length),
    stat('residents', 'Resident', tenantRecords.length),
    stat('stays', 'Stay', stayRecords.length),
    stat('bookings', 'Booking', bookingRecords.length),
    stat('transfers', 'Transfer', transferRecords.length),
    stat('registrations', 'Registration', registrationRecords.length),
    stat('users', 'User', userRecords.length),
  );

  return {
    entities,
    meta: { source: 'live', fetchedAt: new Date().toISOString(), tables, errors },
  };
}

/** Narrowing helper for the committed capture, which is plain JSON on disk. */
export function isEntityBundle(value: unknown): value is EntityBundle {
  return Boolean(value) && Array.isArray((value as EntityBundle).properties);
}
