import type { Bed, FloorPlan, Payment, Resident, RoomGender, Stay } from './types';

const pragueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' });

/**
 * Today's date at the properties (Prague), as YYYY-MM-DD. A function, not a constant:
 * the app stays open for days, and a check-out after midnight must be dated the new day.
 */
export function today(): string {
  return pragueDate.format(new Date());
}

/**
 * Billing starts from zero in Kojeflow: nights are charged from this date on (or from a
 * later check-in), and Airtable's old paid/debt totals are not carried over.
 */
export const BILLING_START = '2026-10-12';

/** Aspect ratio of the seeded plan image, used when a plan has no stored size. */
export const DEFAULT_PLAN_ASPECT = '1539/679';

/**
 * CSS `aspect-ratio` for a floor plan image, so plans of any shape (square schemes
 * included) render undistorted while still stretching to the container width.
 */
export function planAspect(plan: FloorPlan): string {
  return plan.imageWidth && plan.imageHeight ? `${plan.imageWidth}/${plan.imageHeight}` : DEFAULT_PLAN_ASPECT;
}

/**
 * Wide plans get the generous min width that keeps room labels readable; near-square
 * or portrait schemes stay narrower so they do not grow taller than the viewport.
 */
export function planIsWide(plan: FloorPlan): boolean {
  if (!plan.imageWidth || !plan.imageHeight) return true;
  return plan.imageWidth / plan.imageHeight >= 1.3;
}

export function diffDays(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso + 'T00:00:00Z').getTime() - new Date(fromIso + 'T00:00:00Z').getTime()) / 86400000);
}

export function addDays(iso: string, n: number): string {
  const t = new Date(iso + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/**
 * Room gender is a pure derived value, never stored: no occupants -> 'N' (open),
 * one gender -> that gender, both -> 'X' (mixed). This is what makes a mixed room
 * correctly revert to single-gender (or open) once one gender fully vacates.
 */
export function roomGender(roomBeds: Bed[], residentsById: Map<string, Resident>): RoomGender {
  const genders = roomBeds
    .filter((b) => b.status === 'occupied' && b.residentId)
    .map((b) => residentsById.get(b.residentId as string)?.gender)
    .filter(Boolean);
  const hasM = genders.includes('M');
  const hasF = genders.includes('F');
  if (hasM && hasF) return 'X';
  if (hasM) return 'M';
  if (hasF) return 'F';
  return 'N';
}

/** ≥90% green, 60–90% yellow, <60% red — dashboard occupancy-rate banding. */
export function occupancyColor(occRate: number): string {
  if (occRate >= 0.9) return '#22A06B';
  if (occRate >= 0.6) return '#F5A524';
  return '#E5484D';
}

/** free=green, occupied=grey (neutral), booked=yellow, unavailable=red — bed-tile banding. */
export function bedStatusColor(status: Bed['status']): string {
  switch (status) {
    case 'free':
      return '#22A06B';
    case 'occupied':
      return '#B4B4C0';
    case 'booked':
      return '#F5A524';
    case 'unavailable':
      return '#E5484D';
  }
}

/**
 * A property can be booked only while booked < free (strict). Booking reserves the
 * property, never a specific bed — the bed is chosen only at check-in.
 */
export function canBookProperty(freeBeds: number, bookedBeds: number): boolean {
  return bookedBeds < freeBeds;
}

export function hashString(s: string): number {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

/** Deterministic per-bed rate: a property's base price plus a small, stable hash-based spread. */
export function rateFor(basePrice: number, propertyName: string, bedLabel: string): number {
  return basePrice + (hashString(propertyName + '|' + bedLabel) % 6) * 5;
}

export interface Bill {
  days: number;
  rate: number;
  charged: number;
  paid: number;
  balance: number;
  debtor: boolean;
  covered: number; // 0-100
}

/**
 * What a stay has run up since billing started and what is still owed: nights from
 * BILLING_START (or a later check-in) to check-out or today, times the nightly rate,
 * minus the payments recorded in Kojeflow.
 */
export function billFor(stay: Stay, payments: Payment[], asOf: string = today()): Bill {
  const from = stay.checkIn > BILLING_START ? stay.checkIn : BILLING_START;
  const to = stay.checkOut ?? asOf;
  const days = to > from ? diffDays(from, to) : 0;
  const rate = stay.rate;
  const charged = days * rate;
  const paid = payments.filter((p) => p.stayId === stay.id).reduce((sum, p) => sum + p.amount, 0);
  const balance = charged - paid;
  return {
    days,
    rate,
    charged,
    paid,
    balance,
    debtor: balance > 0,
    covered: charged ? Math.min(100, Math.round((paid / charged) * 100)) : 100,
  };
}
