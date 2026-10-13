'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SnapshotPayload } from '@/domain/snapshot';
import { hydrateEntities } from '@/store/entities';
import { setLoadStatus, setSnapshotMeta, useDataSourceStore } from '@/store/dataSource';
import { useSessionStore } from '@/store/session';
import { useT } from '@/i18n/useT';
import { translate } from '@/i18n';
import { rememberLanguage, savedLanguage } from '@/lib/language';

/**
 * Hydrates the entity store from /api/snapshot (Supabase) before any screen renders.
 *
 * Every screen below reads the store synchronously and assumes its data is already
 * there, so the loading state has to be held here rather than in each of them —
 * otherwise each would flash its own "nothing found" empty state on first paint.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const status = useDataSourceStore((s) => s.status);
  const error = useDataSourceStore((s) => s.error);
  const setCurrentUser = useSessionStore((s) => s.setCurrentUser);
  const [attempt, setAttempt] = useState(0);
  const setLang = useSessionStore((s) => s.setLang);

  // The device's last language shows while the profile (which has the final say) loads.
  useEffect(() => {
    const saved = savedLanguage();
    if (saved) setLang(saved);
  }, [setLang]);

  useEffect(() => {
    let cancelled = false;
    setLoadStatus('loading');

    (async () => {
      try {
        const response = await fetch('/api/snapshot', { cache: 'no-store' });
        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: SnapshotPayload = await response.json();
        if (cancelled) return;
        if (!payload.me || !payload.me.active) {
          setLoadStatus('error', translate(useSessionStore.getState().lang, 'err_no_access'));
          return;
        }
        if (payload.me) {
          setCurrentUser(payload.me);
          rememberLanguage(payload.me.language);
        }
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
  }, [attempt, router, setCurrentUser]);

  // Coming back to a tab that sat in the background refreshes the data quietly: colleagues'
  // check-ins appear, and file links (signed for 12 hours) are renewed.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = async () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (!hiddenAt || Date.now() - hiddenAt < 5 * 60_000 || useDataSourceStore.getState().status !== 'ready') return;
      hiddenAt = 0;
      try {
        const response = await fetch('/api/snapshot', { cache: 'no-store' });
        if (response.status === 401) return router.replace('/login');
        if (!response.ok) return;
        const payload: SnapshotPayload = await response.json();
        if (payload.me?.active) hydrateEntities(payload.entities);
      } catch {
        // Offline for a moment: the data on screen stays, the next return tries again.
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [router]);

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
