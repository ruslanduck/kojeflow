'use client';

import { useT } from '@/i18n/useT';
import type { NavKey } from '@/domain/roles';
import { SCREEN_TITLE_KEY, SCREEN_SUB_KEY } from '@/domain/screenTitles';

/** Temporary stand-in for a screen not yet built — replaced task by task per the build plan. */
export function ScreenPlaceholder({ navKey }: { navKey: NavKey }) {
  const t = useT();
  return (
    <section className="screen">
      <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t(SCREEN_TITLE_KEY[navKey])}</h1>
      <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{t(SCREEN_SUB_KEY[navKey])}</p>
      <p style={{ marginTop: 24, color: 'var(--color-faint)', fontSize: 13.5 }}>Screen not built yet.</p>
    </section>
  );
}
