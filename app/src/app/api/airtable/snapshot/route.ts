import { readAirtableEnv } from '@/lib/airtable/config';
import { fetchSnapshot } from '@/lib/airtable/snapshot';
import { loadLocalSnapshot } from '@/lib/airtable/localSnapshot';

// The Airtable token must never reach the browser, and the payload reflects live
// data, so this is never prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * The app's only data endpoint. Reads Airtable when a token is configured and
 * falls back to the committed capture otherwise, so the demo still runs where
 * api.airtable.com is unreachable. Authentication is handled upstream by
 * src/proxy.ts, whose matcher already covers this path.
 */
export async function GET() {
  const env = readAirtableEnv();

  if (!env) return Response.json(loadLocalSnapshot());

  try {
    return Response.json(await fetchSnapshot(env));
  } catch (error) {
    // A live fetch that fails outright still leaves a usable demo, but the reason
    // travels with the payload so /integration can show it rather than silently
    // presenting stale data as live.
    const fallback = loadLocalSnapshot();
    fallback.meta.errors.push(error instanceof Error ? error.message : String(error));
    return Response.json(fallback);
  }
}
