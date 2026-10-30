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
      managers: uniq([...stays.flatMap((s) => [s.manager, s.jobManager]), ...bookings.map((b) => b.manager)]),
      projects: uniq([...stays.map((s) => s.project), ...bookings.map((b) => b.project)]),
    };
  }, [stays, bookings]);
}

/**
 * Choices for commercial bookings and stays, the same lists as Airtable's check-in form: who
 * handles them in the office and how the client came. A value outside them (from an older
 * record) still shows in the select.
 */
const COMMERCIAL_OPTIONS = {
  responsibles: ['Erika Rozman', 'Kateryna Melnyk', 'Valeriia Kondratenko', 'Valeriia Moshkina', 'Vladyslava Vakarova', 'Lilia Mamiseishvili', 'Ivanna Mazar', 'Гуртожиток'],
  customers: ['Напряму', 'Клієнт'],
};

export function useCommercialOptions(): { responsibles: string[]; customers: string[] } {
  return COMMERCIAL_OPTIONS;
}

/** A select over `options`; a value outside them (from an older record) is still shown. */
export function ChoiceSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={FIELD_STYLE}>
      <option value="">{placeholder}</option>
      {all.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
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
