import type { Bed, FloorPlan, Payment, Resident, Room, RoomGender, Stay } from './types';
import namePools from './data/name-pools.json';

/**
 * Reference date all billing and expiry math is measured from.
 *
 * It must not fall behind the Airtable data: a stay that starts after this date
 * yields a negative day count, which clamps to one day and quietly shows a full
 * occupancy as owing a single night. Kept a constant rather than the real clock so
 * that server prerender and client hydration agree — move it to an actual clock
 * (resolved client-side) once the demo stops being rebuilt alongside its data.
 */
export const TODAY = '2026-09-22';

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

export interface RoomLogEntry {
  name: string;
  gender: 'M' | 'F';
  isReal: boolean;
  residentId?: string;
  stayId?: string;
  place: string;
  periodStart: string;
  periodEnd: string | null; // null = still living there (now)
}

/**
 * A room's occupancy history: real current occupants (from live bed/resident/stay
 * data) plus a fixed set of deterministic past-tenant rows, since Stage 1's seed data
 * doesn't carry real check-out history yet. Ported from the prototype's roomLogData(),
 * which fabricates the same fixed-count hash-based past tenants for every room.
 */
export function roomHistoryRows(propertyName: string, room: Room, roomBeds: Bed[], residentsById: Map<string, Resident>, stays: Stay[], today: string = TODAY): RoomLogEntry[] {
  const rows: RoomLogEntry[] = [];
  roomBeds.forEach((bed) => {
    if (bed.status !== 'occupied' || !bed.residentId) return;
    const resident = residentsById.get(bed.residentId);
    if (!resident) return;
    const stay = stays.find((s) => s.residentId === resident.id && s.roomId === room.id && s.status === 'active');
    rows.push({
      name: resident.name,
      gender: resident.gender,
      isReal: true,
      residentId: resident.id,
      stayId: stay?.id,
      place: `${room.name} · Place ${bed.index}`,
      periodStart: stay?.checkIn ?? today,
      periodEnd: null,
    });
  });

  if (roomBeds.length === 0) return rows;
  const { MALE, SURN } = namePools;
  const h = hashString(propertyName + room.name);
  for (let i = 0; i < 3; i++) {
    const name = `${SURN[(h + i * 5) % SURN.length]} ${MALE[(h + i * 3) % MALE.length]}`;
    const periodEnd = addDays(today, -(60 + ((h + i * 29) % 200)));
    rows.push({
      name,
      gender: 'M',
      isReal: false,
      place: `Place ${1 + ((h + i) % roomBeds.length)}`,
      periodStart: addDays(periodEnd, -90),
      periodEnd,
    });
  }
  return rows;
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
 * What a stay has run up and what is still owed.
 *
 * Airtable carries the authoritative balance in its own `debt` formula, and cannot
 * be made to agree with our nights x rate arithmetic: the payment ledger that fed
 * that figure was never recorded transaction by transaction, so `paid` is present
 * on only a fraction of stays. Recomputing the balance ourselves would therefore
 * show almost every resident owing their full stay — a plausible-looking number
 * that is simply wrong. So `debt` wins whenever Airtable supplied one, and only
 * stays created in this session fall back to charged-minus-paid.
 */
export function billFor(stay: Stay, payments: Payment[], today: string = TODAY): Bill {
  const days = Math.max(1, diffDays(stay.checkIn, stay.checkOut ?? today));
  const rate = stay.rate;
  const charged = days * rate;
  const localPaid = payments.filter((p) => p.stayId === stay.id).reduce((sum, p) => sum + p.amount, 0);
  const paid = (stay.paidTotal ?? 0) + localPaid;
  const balance = stay.debt !== undefined ? stay.debt - localPaid : charged - paid;
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
