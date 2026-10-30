import type { Bed, Booking, Property, Room } from './types';

export interface PropertyStat {
  property: Property;
  roomsCount: number;
  /** Available beds in available rooms — Airtable's capacity. */
  total: number;
  occupied: number;
  /** New bookings: a booking reserves a property, never a specific bed. */
  booked: number;
  free: number;
}

export interface BookedCount {
  M: number;
  F: number;
  /** Families and couples. */
  X: number;
  /** Bookings whose person's gender is not known. */
  unknown: number;
  total: number;
}

/**
 * Open bookings of a property, counted from the bookings themselves so that a booking made,
 * cancelled or checked in a minute ago counts at once. `excludeId` leaves out the booking
 * being edited, which must not compete with itself for a bed.
 */
export function bookedCount(bookings: Booking[], propertyId: string, excludeId?: string): BookedCount {
  const count: BookedCount = { M: 0, F: 0, X: 0, unknown: 0, total: 0 };
  for (const b of bookings) {
    if (b.propertyId !== propertyId || b.status !== 'New' || b.id === excludeId) continue;
    if (b.family) count.X++;
    else if (b.gender) count[b.gender]++;
    else count.unknown++;
    count.total++;
  }
  return count;
}

/**
 * Bed counts for one property. `occupiedOverride` replaces today's occupancy with the
 * count for a past day (see public.occupancy_on), so the history picker shows real data.
 */
export function propertyStat(
  property: Property, rooms: Room[], beds: Bed[], bookings: Booking[],
  options: { occupiedOverride?: number; excludeBookingId?: string } = {},
): PropertyStat {
  const propertyRooms = rooms.filter((r) => r.propertyId === property.id);
  // Capacity is the available beds of available rooms, as Airtable counts it; somebody living on
  // a switched-off bed doesn't add a place.
  const propertyBeds = beds.filter((b) => b.propertyId === property.id && b.status !== 'unavailable' && !b.offline);
  const occupied = options.occupiedOverride ?? propertyBeds.filter((b) => b.status === 'occupied').length;
  const total = Math.max(propertyBeds.length, occupied);
  return {
    property,
    // Rooms that offer at least one place, like the beds counted below.
    roomsCount: propertyRooms.filter((r) => propertyBeds.some((b) => b.roomId === r.id)).length,
    total,
    occupied,
    booked: bookedCount(bookings, property.id, options.excludeBookingId).total,
    free: total - occupied,
  };
}
