'use client';

import { useEffect, useState } from 'react';
import { createClient } from './client';
import type { Resident } from '@/domain/types';

export const RESIDENTS_PAGE = 50;

export interface DirectoryResident extends Resident {
  type: 'internal' | 'commercial' | 'refugee' | 'unknown';
}

interface DirectoryState {
  key: string;
  rows: DirectoryResident[];
  total: number | null;
  error: string | null;
}

/**
 * The whole residents directory (all ~33k tenants), searched and paged in the database —
 * the app's own store only holds people with a recent stay.
 */
export function useResidentDirectory(search: string, pages: number, enabled: boolean) {
  const [state, setState] = useState<DirectoryState>({ key: '', rows: [], total: null, error: null });
  const term = search.trim();
  const key = `${term}|${pages}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Typing settles before the query goes out.
    const timer = setTimeout(async () => {
      let query = createClient()
        .from('tenants')
        .select('id, full_name, phone, birth_date, gender, type', { count: 'exact' })
        .order('full_name')
        .range(0, pages * RESIDENTS_PAGE - 1);
      if (term) query = query.ilike('full_name', `%${term.replace(/[%_]/g, '\\$&')}%`);
      const { data, count, error } = await query;
      if (cancelled) return;
      setState({
        key,
        total: count ?? null,
        error: error?.message ?? null,
        rows: (data ?? []).map((t) => ({
          id: t.id,
          name: t.full_name,
          gender: t.gender === 'female' ? 'F' : 'M',
          phone: t.phone ?? undefined,
          dob: t.birth_date ?? undefined,
          type: t.type,
        })),
      });
    }, term ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, term, pages, key]);

  return { rows: state.rows, total: state.total, error: state.error, loading: enabled && state.key !== key };
}
