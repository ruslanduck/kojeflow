import { useEntityStore } from '@/store/entities';
import { check, db } from '@/lib/supabase/write';
import { today } from '@/domain/logic';
import type { Bed, Stay } from '@/domain/types';

export interface CheckInInput {
  residentId: string;
  residentName: string;
  propertyId: string;
  roomId: string;
  /** One stay can take several beds (a family, or someone paying for a whole room). */
  bedIds: string[];
  type: Stay['type'];
  manager: string;
  project: string;
  checkIn?: string;
  bookingId?: string;
  /** The booking's discount, "30%" or an amount; a percentage lowers the nightly rate. */
  discount?: string | null;
  /**
   * The rest of what Airtable's "Create booking by Request" automation copied onto a stay.
   * `officeManager` is Airtable's "manger" (who created the booking, or who checks in);
   * `manager` above is the project's manager ("jobManager").
   */
  officeManager?: string;
  responsible?: string;
  payerName?: string;
  payerTenantId?: string | null;
  note?: string;
  secondPerson?: string;
  registrationNeeded?: boolean;
}

/** An amount discount is stored on the stay as in Airtable; a percentage is already in the rate. */
function discountAmount(discount?: string | null): number | null {
  return parseDiscount(discount)?.amount ?? null;
}

/** "10 %", "10,5%", "300 Kč", "1 000" → { percent } or { amount }; null when it isn't a discount. */
function parseDiscount(discount?: string | null): { percent?: number; amount?: number } | null {
  const text = (discount ?? '').replace(/\s|kč|czk/gi, '').replace(',', '.');
  if (!text) return null;
  const isPercent = text.endsWith('%');
  const value = Number(isPercent ? text.slice(0, -1) : text);
  if (!Number.isFinite(value) || value <= 0 || (isPercent && value >= 100)) return null;
  return isPercent ? { percent: value } : { amount: value };
}

export function isValidDiscount(discount: string): boolean {
  return parseDiscount(discount) !== null;
}

/** Nightly rate of a set of beds for a stay type, after a percentage discount. */
export function rateForBeds(beds: Bed[], type: Stay['type'], discount?: string | null): number {
  const full = beds.reduce((sum, b) => sum + (type === 'Commercial' ? b.priceExternal : b.priceInternal), 0);
  const percent = parseDiscount(discount)?.percent ?? 0;
  const factor = percent ? 1 - percent / 100 : 1;
  return Math.round(full * factor * 100) / 100;
}

/**
 * Checks a resident into one or more free beds: one stay in public.stays holding every bed
 * in public.stay_places. The nightly rate is the sum of the beds' prices for the stay type
 * (internal or commercial), less a percentage discount from the booking.
 */
export async function checkIn(input: CheckInInput): Promise<Stay> {
  const state = useEntityStore.getState();
  const beds = input.bedIds.map((id) => state.beds.find((b) => b.id === id));
  if (!beds.length || beds.some((b) => !b)) throw new Error('err_bed_missing');
  if (beds.some((b) => b!.status !== 'free')) throw new Error('err_bed_taken');
  if (state.stays.some((s) => s.residentId === input.residentId && s.status === 'active')) throw new Error('err_already_living');

  const supabase = db();
  // The store holds only recent data, so the database has the last word on "already living".
  const living = check(
    await supabase.from('stays').select('id').eq('tenant_id', input.residentId).eq('status', 'active').limit(1),
    'Check resident',
  );
  if (living.length) throw new Error('err_already_living');

  const picked = beds as Bed[];
  const rate = rateForBeds(picked, input.type, input.discount);
  const checkInDate = input.checkIn ?? today();

  const stayRow = check(
    await supabase
      .from('stays')
      .insert({
        tenant_id: input.residentId,
        property_id: input.propertyId,
        booking_id: input.bookingId ?? null,
        status: 'active',
        check_in_date: checkInDate,
        original_check_in_date: checkInDate,
        price_type: input.type === 'Commercial' ? 'commercial' : 'internal',
        internal_price: picked[0].priceInternal || null,
        external_price: picked[0].priceExternal || null,
        // No price set for these beds: left empty, so the stay shows up as "no price" instead of free.
        price_per_day: rate || null,
        manager_name: input.officeManager || input.manager || null,
        job_manager_name: input.manager || null,
        responsible_name: input.responsible || null,
        // Airtable keeps the client or project in "customer" for every stay; internal ones name a project too.
        customer: input.project || null,
        project_name: input.type === 'Internal' ? input.project || null : null,
        discount: discountAmount(input.discount),
        payer_tenant_id: input.payerTenantId ?? null,
        payer_name: input.payerName || null,
        note: input.note || null,
        second_tenant_name: input.secondPerson || null,
        registration_needed: Boolean(input.registrationNeeded),
        source: 'app',
      })
      .select('id')
      .single(),
    'Save check-in',
  );

  const held = await supabase.from('stay_places').insert(input.bedIds.map((place_id) => ({ stay_id: stayRow.id, place_id })));
  if (held.error) {
    // Someone took a bed in the meantime (the database allows one active stay per bed).
    check(await supabase.from('stays').update({ status: 'cancelled' }).eq('id', stayRow.id), 'Undo check-in');
    throw new Error(held.error.message.includes('active stay') ? 'err_bed_taken' : `Save check-in: ${held.error.message}`);
  }

  const stay: Stay = {
    id: stayRow.id,
    residentId: input.residentId,
    residentName: input.residentName,
    propertyId: input.propertyId,
    roomId: input.roomId,
    bedId: input.bedIds[0],
    bedIds: input.bedIds,
    type: input.type,
    manager: input.officeManager || input.manager,
    jobManager: input.manager,
    project: input.project,
    checkIn: checkInDate,
    checkOut: null,
    status: 'active',
    rate,
    rateSource: rate > 0 ? 'stay' : 'none',
  };

  useEntityStore.setState((s) => ({
    stays: [stay, ...s.stays],
    beds: s.beds.map((b) => (input.bedIds.includes(b.id) ? { ...b, status: 'occupied', residentId: input.residentId } : b)),
  }));

  // The stay is saved; the booking is closed after, so a failure here can't hide the stay.
  if (input.bookingId) {
    check(await supabase.from('bookings').update({ status: 'checked_in' }).eq('id', input.bookingId), 'Update booking');
    useEntityStore.setState((s) => ({
      bookings: s.bookings.map((b) => (b.id === input.bookingId ? { ...b, status: 'Checked-in' } : b)),
    }));
  }
  return stay;
}

/** Closes an active stay and frees every bed it held. */
export async function checkOut(stayId: string, checkOutDate: string = today()): Promise<Stay> {
  const state = useEntityStore.getState();
  const stay = state.stays.find((s) => s.id === stayId);
  if (!stay) throw new Error('Stay not found: ' + stayId);
  if (stay.status === 'checked-out') return stay;

  const date = checkOutDate < stay.checkIn ? stay.checkIn : checkOutDate;
  check(await db().from('stays').update({ status: 'checked_out', check_out_date: date }).eq('id', stayId), 'Check out');

  const updated: Stay = { ...stay, status: 'checked-out', checkOut: date };
  useEntityStore.setState((s) => ({
    stays: s.stays.map((x) => (x.id === stayId ? updated : x)),
    // Exactly this stay's beds: the same person may hold other beds under another stay.
    beds: s.beds.map((b) => (stay.bedIds.includes(b.id) ? { ...b, status: 'free', residentId: null } : b)),
  }));
  return updated;
}
