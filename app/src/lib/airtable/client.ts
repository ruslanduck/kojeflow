import type { AirtableEnv } from './config';

/** A record as the REST API returns it. Linked fields arrive as plain `rec…` id arrays. */
export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface FetchOptions {
  fields?: string[];
  /** Airtable formula language, e.g. `NOT({end date})`. */
  filterByFormula?: string;
  maxRecords?: number;
  sort?: { field: string; direction?: 'asc' | 'desc' }[];
}

const API_ROOT = 'https://api.airtable.com/v0';
const PAGE_SIZE = 100;
const MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AirtableError extends Error {
  constructor(readonly table: string, readonly status: number, detail: string) {
    super(`Airtable ${table} request failed (${status}): ${detail}`);
    this.name = 'AirtableError';
  }
}

/**
 * One page request, retrying on 429 and 5xx. Airtable's rate limit is 5 req/s per
 * base and it answers 429 with a 30s penalty, so honouring Retry-After matters more
 * than retrying quickly.
 */
async function postPage(
  env: AirtableEnv,
  tableId: string,
  body: Record<string, unknown>,
): Promise<{ records: AirtableRecord[]; offset?: string }> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${API_ROOT}/${env.baseId}/${tableId}/listRecords`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (response.ok) return response.json();

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new AirtableError(tableId, response.status, (await response.text()).slice(0, 300));
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000);
  }
}

/**
 * Fetches a whole table (or the slice `options` selects), following offsets.
 *
 * Uses POST /listRecords rather than GET: fetching Tenants by id needs a
 * `OR(RECORD_ID()=…)` formula far longer than a URL can carry.
 */
export async function fetchTable(
  env: AirtableEnv,
  tableId: string,
  options: FetchOptions = {},
): Promise<AirtableRecord[]> {
  const collected: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const remaining = options.maxRecords ? options.maxRecords - collected.length : PAGE_SIZE;
    if (remaining <= 0) break;

    const page = await postPage(env, tableId, {
      pageSize: Math.min(PAGE_SIZE, remaining),
      ...(options.fields ? { fields: options.fields } : {}),
      ...(options.filterByFormula ? { filterByFormula: options.filterByFormula } : {}),
      ...(options.sort ? { sort: options.sort } : {}),
      ...(offset ? { offset } : {}),
    });

    collected.push(...page.records);
    offset = page.offset;
  } while (offset);

  return collected;
}

/**
 * Fetches specific records by id, in chunks. Airtable has no "where id in (…)"
 * parameter, so this builds `OR(RECORD_ID()=…)` formulas — the only way to pull the
 * ~800 tenants a demo needs out of a 33k-row table without scanning it.
 */
export async function fetchByIds(
  env: AirtableEnv,
  tableId: string,
  ids: string[],
  fields?: string[],
  chunkSize = 80,
): Promise<AirtableRecord[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  const collected: AirtableRecord[] = [];

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    collected.push(...(await fetchTable(env, tableId, { fields, filterByFormula: formula, maxRecords: chunk.length })));
  }

  return collected;
}
