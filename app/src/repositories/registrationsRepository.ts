import { useEntityStore } from '@/store/entities';
import { check, db } from '@/lib/supabase/write';
import type { Registration, RegistrationStatus } from '@/domain/types';

const STATUS_DB: Record<RegistrationStatus, string> = {
  New: 'new', Registered: 'registered', Expired: 'expired', Cancelled: 'rejected',
};

function toRow(r: Partial<Omit<Registration, 'id'>>) {
  const row: Record<string, unknown> = {};
  if (r.residentId !== undefined) row.tenant_id = r.residentId;
  if (r.residentName !== undefined) row.full_name = r.residentName;
  if (r.type !== undefined) row.type = r.type === 'Paid' ? 'paid' : 'free';
  if (r.status !== undefined) row.status = STATUS_DB[r.status];
  if (r.propertyId !== undefined) row.property_id = r.propertyId || null;
  if (r.coordinator !== undefined) row.visa_manager_name = r.coordinator || null;
  if (r.issued !== undefined) row.start_date = r.issued || null;
  if (r.expires !== undefined) row.expiration_date = r.expires || null;
  return row;
}

/** Address registrations (public.registrations). Their scans are not handled in the app yet. */
export const registrationsRepository = {
  async create(input: Omit<Registration, 'id'>, creatorName: string): Promise<Registration> {
    const row = check(
      await db().from('registrations').insert({ ...toRow(input), creator_name: creatorName || null }).select('id').single(),
      'Save registration',
    );
    const registration: Registration = { ...input, id: row.id };
    useEntityStore.setState((s) => ({ registrations: [registration, ...s.registrations] }));
    return registration;
  },

  async update(id: string, patch: Partial<Omit<Registration, 'id'>>): Promise<Registration> {
    const rows = check(await db().from('registrations').update(toRow(patch)).eq('id', id).select('id'), 'Update registration');
    // Row-level security filters an update it refuses instead of failing it.
    if (!rows.length) throw new Error('err_not_allowed');
    let updated: Registration | undefined;
    useEntityStore.setState((s) => ({
      registrations: s.registrations.map((r) => (r.id === id ? (updated = { ...r, ...patch }) : r)),
    }));
    if (!updated) throw new Error('Registration not found: ' + id);
    return updated;
  },
};
