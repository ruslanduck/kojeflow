'use client';

import { useSessionStore } from '@/store/session';
import { useT } from '@/i18n/useT';
import { mappingFor, type EntityName } from '@/lib/airtable/fieldMap';

const AMBER_FG = '#8a5b00';
const AMBER_BG = '#fdf0d0';
const RED_FG = '#a3262b';
const RED_BG = '#fbe0e1';

/**
 * Marks a value whose Airtable source we are not sure of.
 *
 * `unmapped` means the base holds nothing for this field, so whatever the app
 * would show is a placeholder and the marker replaces it outright. `ambiguous`
 * means a real value arrives but from a source whose meaning is still unsettled,
 * so the value stays and the marker sits beside it. Anything mapped or derived
 * renders untouched.
 */
export function Flagged({
  entity,
  field,
  children,
}: {
  entity: EntityName;
  field: string;
  children?: React.ReactNode;
}) {
  const t = useT();
  const showMapping = useSessionStore((s) => s.showMapping);
  const mapping = mappingFor(entity, field);

  if (!showMapping || !mapping || (mapping.status !== 'unmapped' && mapping.status !== 'ambiguous')) {
    return <>{children}</>;
  }

  const source = mapping.table && mapping.field ? `${mapping.table} · ${mapping.field}` : t('map_no_source');
  const title = `${entity}.${field} — ${source}${mapping.note ? `\n\n${mapping.note}` : ''}`;

  if (mapping.status === 'unmapped') {
    return (
      <span
        title={title}
        style={{
          fontSize: 11, fontWeight: 600, color: RED_FG, background: RED_BG,
          borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap', cursor: 'help',
        }}
      >
        {t('map_unmapped')}
      </span>
    );
  }

  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'help' }}>
      {children}
      <span
        aria-label={t('map_ambiguous')}
        style={{
          fontSize: 10, fontWeight: 700, color: AMBER_FG, background: AMBER_BG,
          borderRadius: 5, padding: '1px 5px', whiteSpace: 'nowrap',
        }}
      >
        ?
      </span>
    </span>
  );
}

/**
 * A per-screen summary of what on this screen is not backed by Airtable.
 *
 * Flagging individual cells alone would understate the problem on screens whose
 * whole subject is missing from the base — Finance has no payment ledger, floor
 * plans do not exist there at all — so each screen also states its gaps up front.
 */
export function MappingNotice({ items }: { items: { entity: EntityName; field: string }[] }) {
  const t = useT();
  const showMapping = useSessionStore((s) => s.showMapping);

  const flagged = items
    .map(({ entity, field }) => ({ entity, field, mapping: mappingFor(entity, field) }))
    .filter((item) => item.mapping?.status === 'unmapped' || item.mapping?.status === 'ambiguous');

  if (!showMapping || flagged.length === 0) return null;

  return (
    <div
      style={{
        border: '1px solid #e6c76a', background: '#fdf7e6', borderRadius: 10,
        padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--color-ink)',
      }}
    >
      <div style={{ fontWeight: 700, color: AMBER_FG, marginBottom: 5 }}>{t('map_notice_title')}</div>
      <ul style={{ margin: 0, paddingLeft: 17, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {flagged.map(({ entity, field, mapping }) => (
          <li key={`${entity}.${field}`}>
            <code style={{ fontWeight: 600 }}>{entity}.{field}</code>
            {' — '}
            <span style={{ color: 'var(--color-muted)' }}>
              {mapping?.note ?? (mapping?.status === 'unmapped' ? t('map_no_source') : t('map_ambiguous'))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Marks a record that exists only in this session and was never sent to Airtable. */
export function LocalOnly() {
  const t = useT();
  const showMapping = useSessionStore((s) => s.showMapping);
  if (!showMapping) return null;

  return (
    <span
      title={t('map_local_hint')}
      style={{
        fontSize: 10.5, fontWeight: 600, color: AMBER_FG, background: AMBER_BG,
        borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap', cursor: 'help',
      }}
    >
      {t('map_local')}
    </span>
  );
}
