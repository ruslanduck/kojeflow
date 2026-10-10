import type { Bed, Property, Room } from './types';

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

/**
 * Bed counts for one property. `occupiedOverride` replaces today's occupancy with the
 * count for a past day (see public.occupancy_on), so the history picker shows real data.
 */
export function propertyStat(property: Property, rooms: Room[], beds: Bed[], occupiedOverride?: number): PropertyStat {
  const propertyRooms = rooms.filter((r) => r.propertyId === property.id);
  const propertyBeds = beds.filter((b) => b.propertyId === property.id && b.status !== 'unavailable');
  const occupied = occupiedOverride ?? propertyBeds.filter((b) => b.status === 'occupied').length;
  const total = Math.max(propertyBeds.length, occupied);
  return {
    property,
    roomsCount: propertyRooms.length,
    total,
    occupied,
    booked: property.bookedMale + property.bookedFemale + property.bookedMixed,
    free: total - occupied,
  };
}
