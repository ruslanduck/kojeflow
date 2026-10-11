import { useEntityStore } from '@/store/entities';
import { check, db } from '@/lib/supabase/write';
import type { Booking, BookingStatus } from '@/domain/types';

const STATUS_DB: Record<BookingStatus, string> = { New: 'new', 'Checked-in': 'checked_in', Cancelled: 'cancelled' };

/** "30%" is a percentage, a plain number an amount — the wizard takes either. */
function discountColumns(discount: string | null) {
  const text = (discount ?? '').trim();
  if (!text) return { discount: null, discount_percent: null };
  const value = Number(text.replace('%', '').replace(',', '.'));
  if (!Number.isFinite(value)) return { discount: null, discount_percent: null };
  return text.endsWith('%') ? { discount: null, discount_percent: value } : { discount: value, discount_percent: null };
}

function toRow(b: Partial<Omit<Booking, 'id'>>) {
  const row: Record<string, unknown> = {};
  if (b.propertyId !== undefined) row.property_id = b.propertyId;
  if (b.residentName !== undefined) row.tenant_name = b.residentName;
  if (b.type !== undefined) row.price_type = b.type === 'Commercial' ? 'commercial' : 'internal';
  if (b.date !== undefined) row.start_date = b.date;
  if (b.comment !== undefined) row.note = b.comment || null;
  if (b.by !== undefined) row.creator_name = b.by || null;
  if (b.status !== undefined) row.status = STATUS_DB[b.status];
  if (b.manager !== undefined) row.manager_name = b.manager || null;
  if (b.project !== undefined) row.manager_project = b.project || null;
  if (b.payer !== undefined) row.payer_name = b.payer || null;
  if (b.family !== undefined) row.is_family = b.family;
  if (b.discount !== undefined) Object.assign(row, discountColumns(b.discount));
  return row;
}

/** Bookings (public.bookings): reservations to a property, not to a bed. */
export const bookingsRepository = {
  async create(input: Omit<Booking, 'id'>): Promise<Booking> {
    // The dashboard's booked badges count by gender, so it is taken from the person when known.
    const person = useEntityStore.getState().residents.find((r) => r.name === input.residentName);
    const row = check(
      await db()
        .from('bookings')
        .insert({ ...toRow(input), tenant_id: person?.id ?? null, tenant_gender: person ? (person.gender === 'F' ? 'female' : 'male') : null })
        .select('id')
        .single(),
      'Save booking',
    );
    const booking: Booking = { ...input, id: row.id };
    useEntityStore.setState((s) => ({ bookings: [booking, ...s.bookings] }));
    return booking;
  },

  async update(id: string, patch: Partial<Omit<Booking, 'id'>>): Promise<Booking> {
    check(await db().from('bookings').update(toRow(patch)).eq('id', id), 'Update booking');
    let updated: Booking | undefined;
    useEntityStore.setState((s) => ({
      bookings: s.bookings.map((b) => (b.id === id ? (updated = { ...b, ...patch }) : b)),
    }));
    if (!updated) throw new Error('Booking not found: ' + id);
    return updated;
  },
};
