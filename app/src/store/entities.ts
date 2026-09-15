'use client';

import { create } from 'zustand';
import propertiesSeed from '@/data/seed/properties.json';
import roomsSeed from '@/data/seed/rooms.json';
import bedsSeed from '@/data/seed/beds.json';
import residentsSeed from '@/data/seed/residents.json';
import staysSeed from '@/data/seed/stays.json';
import bookingsSeed from '@/data/seed/bookings.json';
import paymentsSeed from '@/data/seed/payments.json';
import transfersSeed from '@/data/seed/transfers.json';
import registrationsSeed from '@/data/seed/registrations.json';
import usersSeed from '@/data/seed/users.json';
import type {
  Property, Room, Bed, Resident, Stay, Booking, Payment, Transfer, Registration, User,
} from '@/domain/types';

export interface EntityState {
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
}

/**
 * Stage 1 in-memory entity store, seeded from the committed JSON fixtures under
 * src/data/seed/. Mutations live only for the session (mirrors the design
 * prototype's own behavior). Stage 2 swaps the repositories in src/repositories/
 * to call a real API instead of reading/writing this store — components never
 * touch this store directly.
 */
export const useEntityStore = create<EntityState>(() => ({
  properties: propertiesSeed as Property[],
  rooms: roomsSeed as Room[],
  beds: bedsSeed as Bed[],
  residents: residentsSeed as Resident[],
  stays: staysSeed as Stay[],
  bookings: bookingsSeed as Booking[],
  payments: paymentsSeed as Payment[],
  transfers: transfersSeed as Transfer[],
  registrations: registrationsSeed as Registration[],
  users: usersSeed as User[],
}));
