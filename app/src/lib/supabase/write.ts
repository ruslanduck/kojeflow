'use client';

import { createClient } from './client';

const UNIQUE_VIOLATION = '23505';

/** A row with the same number or name already exists (Postgres unique violation). */
export class DuplicateError extends Error {
  constructor(what: string) {
    super(`${what}: already exists`);
  }
}

/** Throws a readable error for a failed Supabase call; RLS refusals arrive here too. */
export function check<T>(result: { data: T; error: { message: string; code?: string } | null }, what: string): NonNullable<T> {
  if (result.error?.code === UNIQUE_VIOLATION) throw new DuplicateError(what);
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as NonNullable<T>;
}

export function db() {
  return createClient();
}

/** Keeps percentages within the column's numeric(6,3) range. */
export function pct(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 1000) / 1000;
}
