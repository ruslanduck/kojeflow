import { createClient } from '@/lib/supabase/server';
import { toPayload, type RawSnapshot } from '@/lib/supabase/snapshot';

// Per-user data under RLS: never prerendered or cached.
export const dynamic = 'force-dynamic';

/** Days of checked-out stays and past bookings the app loads alongside everything active. */
const LOOKBACK_DAYS = 120;

/**
 * The app's data endpoint. Runs public.app_snapshot() as the signed-in user, so the
 * database decides what this user may see; the proxy only keeps anonymous traffic out.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return Response.json({ error: 'Not signed in' }, { status: 401 });

  const { data, error } = await supabase.rpc('app_snapshot', { lookback_days: LOOKBACK_DAYS });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const payload = toPayload(data as RawSnapshot);

  // Plan images sit in a private bucket; hand out URLs that expire well after a working day.
  const plans = payload.entities.floorPlans.filter((p) => p.imagePath);
  if (plans.length) {
    const signed = await supabase.storage.from('floor-plans').createSignedUrls(plans.map((p) => p.imagePath as string), PLAN_URL_SECONDS);
    const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
    for (const plan of plans) plan.imageUrl = urlByPath.get(plan.imagePath as string) ?? '';
  }

  return Response.json(payload);
}

const PLAN_URL_SECONDS = 60 * 60 * 12;
