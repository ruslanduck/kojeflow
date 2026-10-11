import { useEntityStore } from '@/store/entities';
import { check, db } from '@/lib/supabase/write';
import { TODAY } from '@/domain/logic';
import type { Stay } from '@/domain/types';

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
}

/**
 * Checks a resident into one or more free beds: one stay in public.stays holding every bed
 * in public.stay_places. The nightly rate is the sum of the beds' room prices for the stay
 * type (internal or commercial).
 */
export async function checkIn(input: CheckInInput): Promise<Stay> {
  const state = useEntityStore.getState();
  const beds = input.bedIds.map((id) => state.beds.find((b) => b.id === id));
  if (!beds.length || beds.some((b) => !b)) throw new Error('Bed not found');
  if (beds.some((b) => b!.status !== 'free')) throw new Error('A selected bed is no longer free');

  const room = state.rooms.find((r) => r.id === input.roomId);
  const bedPrice = input.type === 'Commercial' ? room?.priceTo ?? 0 : room?.priceFrom ?? 0;
  const rate = bedPrice * beds.length;
  const checkInDate = input.checkIn ?? TODAY;

  const supabase = db();
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
        internal_price: room?.priceFrom ?? null,
        external_price: room?.priceTo ?? null,
        price_per_day: rate,
        manager_name: input.manager || null,
        project_name: input.project || null,
        source: 'app',
      })
      .select('id')
      .single(),
    'Save check-in',
  );

  const held = await supabase.from('stay_places').insert(input.bedIds.map((place_id) => ({ stay_id: stayRow.id, place_id })));
  if (held.error) {
    // Someone took a bed in the meantime (the database allows one active stay per bed).
    await supabase.from('stays').update({ status: 'cancelled' }).eq('id', stayRow.id);
    throw new Error(`Save check-in: ${held.error.message}`);
  }

  if (input.bookingId) {
    check(await supabase.from('bookings').update({ status: 'checked_in' }).eq('id', input.bookingId), 'Update booking');
  }

  const stay: Stay = {
    id: stayRow.id,
    residentId: input.residentId,
    residentName: input.residentName,
    propertyId: input.propertyId,
    roomId: input.roomId,
    bedId: input.bedIds[0],
    type: input.type,
    manager: input.manager,
    project: input.project,
    checkIn: checkInDate,
    checkOut: null,
    status: 'active',
    rate,
  };

  useEntityStore.setState((s) => ({
    stays: [stay, ...s.stays],
    beds: s.beds.map((b) => (input.bedIds.includes(b.id) ? { ...b, status: 'occupied', residentId: input.residentId } : b)),
    bookings: input.bookingId ? s.bookings.map((b) => (b.id === input.bookingId ? { ...b, status: 'Checked-in' } : b)) : s.bookings,
  }));
  return stay;
}

/** Closes an active stay and frees every bed it held. */
export async function checkOut(stayId: string, checkOutDate: string = TODAY): Promise<Stay> {
  const state = useEntityStore.getState();
  const stay = state.stays.find((s) => s.id === stayId);
  if (!stay) throw new Error('Stay not found: ' + stayId);
  if (stay.status === 'checked-out') return stay;

  const date = checkOutDate < stay.checkIn ? stay.checkIn : checkOutDate;
  check(await db().from('stays').update({ status: 'checked_out', check_out_date: date }).eq('id', stayId), 'Check out');

  const updated: Stay = { ...stay, status: 'checked-out', checkOut: date };
  useEntityStore.setState((s) => ({
    stays: s.stays.map((x) => (x.id === stayId ? updated : x)),
    // The store keeps one bed per stay, so every bed this resident holds in the property is freed.
    beds: s.beds.map((b) =>
      b.residentId === stay.residentId && b.propertyId === stay.propertyId ? { ...b, status: 'free', residentId: null } : b,
    ),
  }));
  return updated;
}
