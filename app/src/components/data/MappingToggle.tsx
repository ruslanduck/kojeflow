'use client';

import { useSessionStore } from '@/store/session';
import { useT } from '@/i18n/useT';

/**
 * Turns the Airtable verification flags on and off, so one build serves both a
 * clean client demo and a field-by-field check against the base.
 */
export function MappingToggle() {
  const t = useT();
  const showMapping = useSessionStore((s) => s.showMapping);
  const toggleMapping = useSessionStore((s) => s.toggleMapping);

  return (
    <button
      onClick={toggleMapping}
      aria-pressed={showMapping}
      title={t('map_toggle_hint')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap',
        border: `1px solid ${showMapping ? '#e6c76a' : 'var(--color-border-strong)'}`,
        background: showMapping ? '#fdf0d0' : '#fff',
        color: showMapping ? '#8a5b00' : 'var(--color-muted)',
        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 7, height: 7, borderRadius: '50%',
          background: showMapping ? '#b8860b' : 'var(--color-faint-2)',
        }}
      />
      {t('map_toggle')}
    </button>
  );
}
