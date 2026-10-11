'use client';

import { useId, useMemo } from 'react';
import { useEntityStore } from '@/store/entities';
import { FIELD_STYLE } from './formStyles';

/** Managers and projects people have actually used, for suggestions under free-text fields. */
export function useKnownNames(): { managers: string[]; projects: string[] } {
  const stays = useEntityStore((s) => s.stays);
  const bookings = useEntityStore((s) => s.bookings);
  return useMemo(() => {
    const uniq = (values: string[]) =>
      Array.from(new Set(values.map((v) => v.trim()).filter((v) => v && v !== '—'))).sort((a, b) => a.localeCompare(b));
    return {
      managers: uniq([...stays.map((s) => s.manager), ...bookings.map((b) => b.manager)]),
      projects: uniq([...stays.map((s) => s.project), ...bookings.map((b) => b.project)]),
    };
  }, [stays, bookings]);
}

/** A text field that accepts anything and suggests known values. */
export function SuggestInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const listId = useId();
  return (
    <>
      <input value={value} onChange={(e) => onChange(e.target.value)} list={listId} placeholder={placeholder} style={FIELD_STYLE} autoComplete="off" />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}
