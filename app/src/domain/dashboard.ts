import type { Bed, Property, Room } from './types';
import { diffDays, TODAY } from './logic';

export interface PropertyStat {
  property: Property;
  roomsCount: number;
  total: number;
  occupied: number;
  booked: number;
  free: number;
}

export function propertyStat(property: Property, rooms: Room[], beds: Bed[]): PropertyStat {
  const propertyRooms = rooms.filter((r) => r.propertyId === property.id);
  const propertyBeds = beds.filter((b) => b.propertyId === property.id);
  const occupied = propertyBeds.filter((b) => b.status === 'occupied').length;
  const booked = propertyBeds.filter((b) => b.status === 'booked').length;
  return {
    property,
    roomsCount: propertyRooms.length,
    total: propertyBeds.length,
    occupied,
    booked,
    free: propertyBeds.length - occupied - booked,
  };
}

/** How many days the dashboard's history picker is looking into the past, relative to TODAY. */
export function dayShift(dashDateIso: string, today: string = TODAY): number {
  return diffDays(dashDateIso, today);
}

/**
 * The prototype has no real historical snapshots, so past dates simulate lower
 * occupancy by shaving a fraction of a day's worth off the live count. Ported
 * verbatim so picking a date in the dashboard's history picker behaves the same way.
 */
export function occupancyAdjustedForShift(occupied: number, shift: number): number {
  return Math.max(0, occupied - Math.round(shift * 0.35));
}

export interface ShiftedStat extends PropertyStat {
  adjustedOccupied: number;
  adjustedFree: number;
}

export function applyDayShift(stat: PropertyStat, shift: number): ShiftedStat {
  const adjustedOccupied = occupancyAdjustedForShift(stat.occupied, shift);
  return { ...stat, adjustedOccupied, adjustedFree: stat.free + (stat.occupied - adjustedOccupied) };
}
