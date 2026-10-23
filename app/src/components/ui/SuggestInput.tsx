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
 * Choices for commercial bookings and stays: who handles them in the office and which client
 * they come through, as Airtable has them ("Напряму", "Клієнт"). The current value always stays
 * selectable, even when it is not among them.
 */
export function useCommercialOptions(): { responsibles: string[]; customers: string[] } {
  const stays = useEntityStore((s) => s.stays);
  const bookings = useEntityStore((s) => s.bookings);
  return useMemo(() => {
    const uniq = (values: string[]) =>
      Array.from(new Set(values.map((v) => v.trim()).filter((v) => v && v !== '—'))).sort((a, b) => a.localeCompare(b));
    const commercialStays = stays.filter((s) => s.type === 'Commercial');
    const commercialBookings = bookings.filter((b) => b.type === 'Commercial');
    const customers = uniq([...commercialStays.map((s) => s.project), ...commercialBookings.map((b) => b.project)]);
    return {
      responsibles: uniq([...commercialStays.map((s) => s.manager), ...commercialBookings.flatMap((b) => [b.responsible, b.by])]),
      customers: customers.length ? customers : ['Напряму', 'Клієнт'],
    };
  }, [stays, bookings]);
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
