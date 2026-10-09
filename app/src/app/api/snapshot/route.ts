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

  return Response.json(toPayload(data as RawSnapshot));
}
