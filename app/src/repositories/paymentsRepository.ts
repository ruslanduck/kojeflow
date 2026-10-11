import { useEntityStore } from '@/store/entities';
import { useSessionStore } from '@/store/session';
import { check, db } from '@/lib/supabase/write';
import type { Payment } from '@/domain/types';

const BUCKET = 'payment-proofs';
const URL_SECONDS = 60 * 60 * 12;

export interface NewPayment {
  stayId: string;
  propertyId: string;
  amount: number;
  /** YYYY-MM-DD the money came in. */
  at: string;
  note: string;
  /** Bank statement or screenshot; required by the billing flow. */
  proof: File;
}

/** Payments (public.payments): each one recorded under the signed-in user, with its proof file. */
export const paymentsRepository = {
  async create(input: NewPayment): Promise<Payment> {
    const { userId, profileName } = useSessionStore.getState();
    if (!userId) throw new Error('err_signed_out');
    const stay = useEntityStore.getState().stays.find((s) => s.id === input.stayId);
    const supabase = db();

    const path = `${input.propertyId}/${input.stayId}/${crypto.randomUUID()}-${input.proof.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)}`;
    check(await supabase.storage.from(BUCKET).upload(path, input.proof, { contentType: input.proof.type || undefined }), 'Upload proof');

    const row = check(
      await supabase
        .from('payments')
        .insert({
          stay_id: input.stayId,
          tenant_id: stay?.residentId ?? null,
          property_id: input.propertyId,
          amount: input.amount,
          // Noon in Prague keeps the date the same whatever the viewer's time zone.
          paid_at: `${input.at}T12:00:00+02:00`,
          proof_path: path,
          note: input.note || null,
          created_by: userId,
        })
        .select('id')
        .single(),
      'Save payment',
    );

    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_SECONDS);
    const payment: Payment = {
      id: row.id,
      stayId: input.stayId,
      propertyId: input.propertyId,
      amount: input.amount,
      by: profileName,
      at: input.at,
      docName: input.proof.name,
      docUrl: signed.data?.signedUrl ?? '',
      note: input.note,
    };
    useEntityStore.setState((s) => ({
      payments: [payment, ...s.payments],
      properties: s.properties.map((p) => (p.id === input.propertyId ? { ...p, balance: p.balance + input.amount } : p)),
    }));
    return payment;
  },
};
