'use client';

import { useEffect, useState } from 'react';
import type { SnapshotPayload } from '@/domain/snapshot';
import { hydrateEntities } from '@/store/entities';
import { setLoadStatus, setSnapshotMeta, useDataSourceStore } from '@/store/dataSource';
import { useT } from '@/i18n/useT';

/**
 * Hydrates the entity store from /api/airtable/snapshot before any screen renders.
 *
 * Every screen below reads the store synchronously and assumes its data is already
 * there, so the loading state has to be held here rather than in each of them —
 * otherwise each would flash its own "nothing found" empty state on first paint.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const status = useDataSourceStore((s) => s.status);
  const error = useDataSourceStore((s) => s.error);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadStatus('loading');

    (async () => {
      try {
        const response = await fetch('/api/airtable/snapshot', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: SnapshotPayload = await response.json();
        if (cancelled) return;
        hydrateEntities(payload.entities);
        setSnapshotMeta(payload.meta);
        setLoadStatus('ready');
      } catch (cause) {
        if (cancelled) return;
        setLoadStatus('error', cause instanceof Error ? cause.message : String(cause));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (status === 'ready') return <>{children}</>;

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, minHeight: '60vh', padding: 24, textAlign: 'center',
      }}
    >
      {status === 'error' ? (
        <>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600 }}>{t('dl_error')}</div>
          <div style={{ color: 'var(--color-muted)', fontSize: 13, maxWidth: 420 }}>{error}</div>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            style={{
              marginTop: 4, padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
              border: '1px solid var(--color-border-strong)', background: '#fff',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
            }}
          >
            {t('dl_retry')}
          </button>
        </>
      ) : (
        <>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600 }}>{t('dl_loading')}</div>
          <div style={{ color: 'var(--color-faint)', fontSize: 13 }}>{t('dl_loading_sub')}</div>
        </>
      )}
    </div>
  );
}
