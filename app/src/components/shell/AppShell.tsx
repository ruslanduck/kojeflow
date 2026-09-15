'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { ROLES, ROLE_NAMES, NAV_LABEL_KEY, NAV_ROUTE, roleLabelKey, type NavKey, type RoleName } from '@/domain/roles';
import { SCREEN_TITLE_KEY } from '@/domain/screenTitles';
import { initials } from '@/lib/text';
import { NavIcon } from './NavIcon';

const LOGO_GRADIENT = 'linear-gradient(135deg,#FFD600 0%,#E500E5 100%)';
const TAB_PREFERENCE: NavKey[] = ['dashboard', 'bookings', 'checkin', 'residents'];

function useCurrentNavKey(nav: NavKey[]): NavKey {
  const pathname = usePathname();
  return (
    nav.find((k) => pathname === NAV_ROUTE[k] || pathname.startsWith(NAV_ROUTE[k] + '/')) ?? nav[0]
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const role = useSessionStore((s) => s.role);
  const setRole = useSessionStore((s) => s.setRole);
  const profileName = useSessionStore((s) => s.profileName);
  const toast = useSessionStore((s) => s.toast);
  const sheetOpen = useSessionStore((s) => s.sheetOpen);
  const openSheet = useSessionStore((s) => s.openSheet);
  const closeSheet = useSessionStore((s) => s.closeSheet);

  const roleConfig = ROLES[role];
  const nav = roleConfig.nav;
  const currentNavKey = useCurrentNavKey(nav);

  const canGoBack =
    !nav.some((k) => pathname === NAV_ROUTE[k]) || searchParams.toString() !== '';

  const tabKeys = useMemo(() => {
    const keys = TAB_PREFERENCE.filter((k) => nav.includes(k));
    for (const k of nav) {
      if (keys.length >= 4) break;
      if (k !== 'settings' && !keys.includes(k)) keys.push(k);
    }
    return keys;
  }, [nav]);
  const inTabs = new Set(tabKeys);
  const overflowKeys = nav.filter((k) => !inTabs.has(k));

  const screenTitle = t(SCREEN_TITLE_KEY[currentNavKey]) || 'Kojeflow';

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* DESKTOP SIDEBAR */}
      <aside
        className="sidebar"
        style={{ width: 252, flex: 'none', background: '#fff', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', padding: '20px 0' }}
      >
        <div style={{ padding: '0 20px 18px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: LOGO_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 23, color: 'var(--color-ink)' }}>
            K
          </div>
          <div>
            <div className="hd" style={{ fontSize: 21 }}>Kojeflow</div>
            <div style={{ fontSize: 9.5, color: 'var(--color-muted)', letterSpacing: 1.1, fontWeight: 600 }}>{t('ops')}</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {nav.map((k) => {
            const on = k === currentNavKey;
            return (
              <button
                key={k}
                className="navbtn"
                onClick={() => router.push(NAV_ROUTE[k])}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  background: on ? '#141414' : 'transparent', color: on ? '#fff' : 'var(--color-ink)',
                  border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13.5,
                  fontWeight: on ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: on ? 'var(--color-yellow)' : 'var(--color-scrollbar)' }} />
                <span>{t(NAV_LABEL_KEY[k])}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ padding: '12px 12px 0', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 9.5, color: 'var(--color-faint)', textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 6px 6px', fontWeight: 700 }}>
            {t('viewAsRole')}
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleName)}
            style={{ width: '100%', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 30px 9px 11px', fontSize: 13, outline: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            {ROLE_NAMES.map((r) => (
              <option key={r} value={r}>{t(roleLabelKey(r))}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 6px 0' }}>
            <div style={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', background: 'var(--color-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--color-ink)' }}>
              {initials(profileName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileName}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{t(roleLabelKey(role))}</div>
            </div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* MOBILE TOPBAR */}
        <div className="topbar" style={{ alignItems: 'center', gap: 11, padding: '10px 13px', background: '#fff', borderBottom: '1px solid var(--color-border)' }}>
          {canGoBack && (
            <button onClick={() => router.back()} aria-label="Back" style={{ background: 'none', border: 'none', color: 'var(--color-ink)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px 2px 2px' }}>
              ‹
            </button>
          )}
          <div style={{ width: 29, height: 29, flex: 'none', borderRadius: 8, background: LOGO_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: 'var(--color-ink)' }}>
            K
          </div>
          <div className="hd" style={{ flex: 1, minWidth: 0, fontSize: 19, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {screenTitle}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </main>

      {/* MOBILE TAB BAR */}
      <nav className="tabbar">
        {tabKeys.map((k) => {
          const on = k === currentNavKey;
          return (
            <button key={k} className={'tabbtn' + (on ? ' on' : '')} onClick={() => router.push(NAV_ROUTE[k])} aria-label={t(NAV_LABEL_KEY[k])}>
              <NavIcon icon={k} />
              <span>{t(NAV_LABEL_KEY[k])}</span>
            </button>
          );
        })}
        <button className={'tabbtn' + (sheetOpen ? ' on' : '')} onClick={openSheet} aria-label={t('tab_profile')}>
          <NavIcon icon="profile" />
          <span>{t('tab_profile')}</span>
        </button>
      </nav>

      {/* PROFILE SHEET */}
      <div className={'sheet' + (sheetOpen ? ' open' : '')} onClick={closeSheet}>
        {sheetOpen && (
          <div className="sheetcard" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 38, height: 4, borderRadius: 3, background: '#E0E0E8' }} />
            </div>
            <div style={{ padding: '12px 20px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ width: 46, height: 46, flex: 'none', borderRadius: '50%', background: 'var(--color-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: 'var(--color-ink)' }}>
                {initials(profileName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="hd" style={{ fontSize: 19, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileName}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{t(roleLabelKey(role))}</div>
              </div>
              <button onClick={closeSheet} style={{ background: 'var(--color-bg)', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 19, lineHeight: 1, color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                &times;
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {overflowKeys.map((k) => {
                  const on = k === currentNavKey;
                  return (
                    <button
                      key={k}
                      onClick={() => { closeSheet(); router.push(NAV_ROUTE[k]); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: on ? '#141414' : 'var(--color-bg)', color: on ? '#fff' : 'var(--color-ink)', border: 'none', borderRadius: 12, padding: '14px 15px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: on ? 'var(--color-yellow)' : 'var(--color-scrollbar)' }} />
                      <span style={{ flex: 1, textAlign: 'left' }}>{t(NAV_LABEL_KEY[k])}</span>
                      <span style={{ color: '#C9C9D4', fontSize: 15 }}>›</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 9.5, color: 'var(--color-faint)', textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 4px 7px', fontWeight: 700 }}>
                  {t('viewAsRole')}
                </div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleName)}
                  style={{ width: '100%', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 11, padding: '12px 32px 12px 13px', fontSize: 14, outline: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  {ROLE_NAMES.map((r) => (
                    <option key={r} value={r}>{t(roleLabelKey(r))}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#141414', color: '#fff', padding: '13px 22px', borderRadius: 11, fontSize: 13.5, fontWeight: 500, zIndex: 200, animation: 'slideUp .2s ease', boxShadow: '0 8px 30px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
