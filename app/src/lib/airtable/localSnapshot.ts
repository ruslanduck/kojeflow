import type { SnapshotPayload, TableStat } from '@/domain/snapshot';
import { emptyBundle } from '@/domain/snapshot';
import { APPROX_TOTALS, TABLES, type TableKey } from './config';
import type { AirtableRecord } from './client';
import {
  applyOccupancy, mapBed, mapBooking, mapProperty, mapRegistration, mapResident,
  mapRoom, mapStay, mapTransfer, mapUser, tenantStayType,
} from './mappers';

import propertyRecords from '@/data/capture/properties.json';
import roomRecords from '@/data/capture/rooms.json';
import bedRecords from '@/data/capture/beds.json';
import residentRecords from '@/data/capture/residents.json';
import stayRecords from '@/data/capture/stays.json';
import bookingRecords from '@/data/capture/bookings.json';
import transferRecords from '@/data/capture/transfers.json';
import registrationRecords from '@/data/capture/registrations.json';
import userRecords from '@/data/capture/users.json';

/**
 * A capture of the real base, taken through the Airtable MCP tools and stored in
 * the exact shape the REST API returns. It runs through the same mappers as the
 * live path, so this is a genuine rehearsal of the integration rather than a
 * parallel fixture that could drift.
 *
 * It is deliberately narrow: five hostels (Chuchle, Korycany, Morina, Hostivice,
 * Behovice) with their rooms, places, active stays and the people in them. The
 * /integration page reports that scope so a partial table is never read as an
 * empty one.
 */
export const SNAPSHOT_HOSTELS = ['Chuchle', 'Korycany', 'Morina', 'Hostivice', 'Behovice'];

/** Captured at a fixed moment; shown on the diagnostics page so staleness is visible. */
export const SNAPSHOT_TAKEN_AT = '2026-09-22T00:00:00.000Z';

/**
 * Every person in the capture is an invented stand-in. This repository is public,
 * and the real records are migrant workers' names, phone numbers, dates of birth and
 * links to passport scans — none of which may be published. `scripts/pseudonymize-capture.js`
 * rewrites each name to a stable alias and strips phone, birthday, passport and the
 * free-text request comments, which carried personal circumstances no field-level
 * redaction could clean. Re-run it after any re-capture.
 *
 * Structure is untouched: occupancy, rooms, prices, balances, dates and statuses are
 * the real figures, which is what makes the demo worth checking. Live mode, with a
 * token configured, reads the genuine records.
 */
export const SNAPSHOT_PSEUDONYMIZED = true;

/** Fields the capture cannot carry, though live Airtable supplies them. */
export const SNAPSHOT_WITHHELD = ['Resident.phone', 'Resident.dob', 'Resident.passportDocs', 'Booking.comment'];

const CAPTURES: Record<TableKey, AirtableRecord[]> = {
  properties: propertyRecords as AirtableRecord[],
  rooms: roomRecords as AirtableRecord[],
  beds: bedRecords as AirtableRecord[],
  residents: residentRecords as AirtableRecord[],
  stays: stayRecords as AirtableRecord[],
  bookings: bookingRecords as AirtableRecord[],
  transfers: transferRecords as AirtableRecord[],
  registrations: registrationRecords as AirtableRecord[],
  users: userRecords as AirtableRecord[],
};

const ENTITY_OF: Record<TableKey, string> = {
  properties: 'Property', rooms: 'Room', beds: 'Bed', residents: 'Resident',
  stays: 'Stay', bookings: 'Booking', transfers: 'Transfer',
  registrations: 'Registration', users: 'User',
};

function stats(): TableStat[] {
  return (Object.keys(CAPTURES) as TableKey[]).map((key) => ({
    table: TABLES[key].name,
    entity: ENTITY_OF[key],
    fetched: CAPTURES[key].length,
    total: APPROX_TOTALS[key],
    // The capture covers 5 of 26 hostels, so every table here is a subset by design.
    capped: CAPTURES[key].length < APPROX_TOTALS[key],
  }));
}

export function loadLocalSnapshot(): SnapshotPayload {
  const entities = emptyBundle();

  entities.properties = CAPTURES.properties.map(mapProperty);
  entities.rooms = CAPTURES.rooms.map(mapRoom);

  const roomToProperty = new Map(entities.rooms.map((room) => [room.id, room.propertyId]));
  const rawBeds = CAPTURES.beds.map((record) => mapBed(record, roomToProperty));
  const bedToRoom = new Map(rawBeds.map((bed) => [bed.id, bed.roomId]));

  const tenantsById = new Map(CAPTURES.residents.map((record) => [record.id, record]));
  const stayTypeOf = (record: AirtableRecord) =>
    tenantStayType(tenantsById.get(((record.fields.tenant as string[] | undefined) ?? [])[0] ?? ''));

  entities.residents = CAPTURES.residents.map(mapResident);
  entities.stays = CAPTURES.stays.map((record) => mapStay(record, stayTypeOf(record), bedToRoom));
  entities.bookings = CAPTURES.bookings.map((record) => mapBooking(record, stayTypeOf(record)));
  entities.transfers = CAPTURES.transfers.map(mapTransfer);
  entities.registrations = CAPTURES.registrations.map(mapRegistration);
  entities.users = CAPTURES.users.map(mapUser);
  entities.beds = applyOccupancy(rawBeds, entities.stays);

  return {
    entities,
    meta: {
      source: 'snapshot',
      fetchedAt: SNAPSHOT_TAKEN_AT,
      tables: stats(),
      errors: [],
    },
  };
}
