'use client';

import { useMemo } from 'react';
import { useT } from '@/i18n/useT';
import { useDataSourceStore } from '@/store/dataSource';
import { ENTITY_TABLE, FIELD_MAP, countByStatus, type EntityName, type MappingStatus } from '@/lib/airtable/fieldMap';
import { SNAPSHOT_HOSTELS, SNAPSHOT_PSEUDONYMIZED, SNAPSHOT_WITHHELD } from '@/lib/airtable/localSnapshot';

const STATUS_STYLE: Record<MappingStatus, { fg: string; bg: string }> = {
  mapped: { fg: '#1b6b47', bg: '#dff1e4' },
  derived: { fg: '#2f4a8c', bg: '#e3e9fa' },
  ambiguous: { fg: '#8a5b00', bg: '#fdf0d0' },
  unmapped: { fg: '#a3262b', bg: '#fbe0e1' },
};

const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '16px 18px',
};

function StatusChip({ status }: { status: MappingStatus }) {
  const t = useT();
  const { fg, bg } = STATUS_STYLE[status];
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 600, color: fg, background: bg,
        borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap',
      }}
    >
      {t(`st_${status}`)}
    </span>
  );
}

/**
 * The verification surface for the Airtable integration: which table backs each
 * entity, how much of it actually loaded, and — field by field — whether the value
 * on screen is trustworthy or still an open question.
 */
export function IntegrationScreen() {
  const t = useT();
  const meta = useDataSourceStore((s) => s.meta);
  const totals = useMemo(() => countByStatus(), []);
  const entities = Object.keys(FIELD_MAP) as EntityName[];

  const open = useMemo(
    () =>
      entities.flatMap((entity) =>
        Object.entries(FIELD_MAP[entity])
          .filter(([, mapping]) => mapping.status === 'unmapped' || mapping.status === 'ambiguous')
          .map(([field, mapping]) => ({ entity, field, mapping })),
      ),
    [entities],
  );

  return (
    <div className="screen">
      <div className="hd" style={{ fontSize: 25, marginBottom: 4 }}>{t('ig_title')}</div>
      <div style={{ color: 'var(--color-muted)', fontSize: 13.5, marginBottom: 22, maxWidth: 640 }}>{t('ig_sub')}</div>

      {/* Totals across the whole contract, so the shape of the gap is visible at a glance. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {(Object.keys(totals) as MappingStatus[]).map((status) => (
          <div key={status} style={{ ...CARD, minWidth: 116, padding: '12px 15px' }}>
            <div className="fig" style={{ fontSize: 23, color: STATUS_STYLE[status].fg }}>{totals[status]}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 1 }}>{t(`st_${status}`)}</div>
          </div>
        ))}
      </div>

      <div style={{ ...CARD, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-faint)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
              {t('ig_source')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>
              {meta?.source === 'live' ? t('ig_source_live') : t('ig_source_snapshot')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-faint)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
              {t('ig_fetched')}
            </div>
            <div className="num" style={{ fontSize: 14, marginTop: 3 }}>
              {meta ? new Date(meta.fetchedAt).toLocaleString() : '—'}
            </div>
          </div>
        </div>

        {meta?.source === 'snapshot' && (
          <>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--color-border-strong)', fontSize: 12.5, color: 'var(--color-muted)' }}>
              <b style={{ color: 'var(--color-ink)' }}>{t('ig_scope')}:</b> {t('ig_scope_sub')} {SNAPSHOT_HOSTELS.join(', ')}.
            </div>
            {SNAPSHOT_PSEUDONYMIZED && (
              <div style={{ marginTop: 10, padding: '10px 13px', borderRadius: 8, background: '#fdf0d0', fontSize: 12.5, color: 'var(--color-ink)' }}>
                <b style={{ color: '#8a5b00' }}>{t('ig_pseudo')}:</b> {t('ig_pseudo_sub')}{' '}
                <span style={{ color: 'var(--color-muted)' }}>{SNAPSHOT_WITHHELD.join(', ')}.</span>
              </div>
            )}
          </>
        )}

        {meta?.errors.length ? (
          <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, background: '#fbe0e1', fontSize: 12.5 }}>
            <b style={{ color: '#a3262b' }}>{t('ig_errors')}:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {meta.errors.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Loaded-vs-total, so a deliberately capped table is never read as an empty one. */}
      <div style={{ ...CARD, marginBottom: 26, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 90px 90px', gap: 8, padding: '10px 18px', background: 'var(--color-bg)', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <div>{t('ig_entity')}</div>
          <div>{t('ig_table')}</div>
          <div style={{ textAlign: 'right' }}>{t('ig_records')}</div>
          <div style={{ textAlign: 'right' }}>{t('ig_total')}</div>
        </div>
        {(meta?.tables ?? []).map((row) => (
          <div key={row.entity} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 90px 90px', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--color-border)', fontSize: 13, alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>{row.entity}</div>
            <div style={{ color: 'var(--color-muted)' }}>{row.table}</div>
            <div className="num" style={{ textAlign: 'right', fontWeight: 600, color: row.capped ? '#8a5b00' : 'var(--color-ink)' }}>
              {row.fetched}
            </div>
            <div className="num" style={{ textAlign: 'right', color: 'var(--color-faint)' }}>{row.total}</div>
          </div>
        ))}
      </div>

      {/* The open questions, gathered up front — this is the list that drives the next round. */}
      <div className="hd" style={{ fontSize: 17, marginBottom: 10 }}>{t('ig_open')} ({open.length})</div>
      <div style={{ ...CARD, marginBottom: 30, padding: 0, overflow: 'hidden' }}>
        {open.map(({ entity, field, mapping }) => (
          <div key={`${entity}.${field}`} style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontSize: 13, fontWeight: 600 }}>{entity}.{field}</code>
              <StatusChip status={mapping.status} />
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                {mapping.table && mapping.field ? `${mapping.table} · ${mapping.field}` : t('ig_no_table')}
              </span>
            </div>
            {mapping.note && (
              <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 5, maxWidth: 780 }}>{mapping.note}</div>
            )}
          </div>
        ))}
      </div>

      {/* Then the full contract, entity by entity. */}
      {entities.map((entity) => (
        <div key={entity} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 8 }}>
            <div className="hd" style={{ fontSize: 16 }}>{entity}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
              {ENTITY_TABLE[entity] ? `→ ${ENTITY_TABLE[entity]}` : t('ig_no_table')}
            </div>
          </div>
          <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
            {Object.entries(FIELD_MAP[entity]).map(([field, mapping]) => (
              <div
                key={field}
                style={{
                  display: 'grid', gridTemplateColumns: '180px 1fr 110px', gap: 12,
                  padding: '9px 16px', borderTop: '1px solid var(--color-border)',
                  fontSize: 12.5, alignItems: 'center',
                }}
              >
                <code style={{ fontWeight: 600 }}>{field}</code>
                <div style={{ color: 'var(--color-muted)', minWidth: 0 }}>
                  {mapping.table && mapping.field ? `${mapping.table} · ${mapping.field}` : '—'}
                  {mapping.note && <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{mapping.note}</div>}
                </div>
                <div style={{ textAlign: 'right' }}><StatusChip status={mapping.status} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
