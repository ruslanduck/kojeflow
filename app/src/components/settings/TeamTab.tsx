'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/i18n/useT';
import { errorText } from '@/i18n/errors';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { teamRepository, type TeamMember } from '@/repositories/teamRepository';
import { ROLE_NAMES, ROLES, roleLabelKey, type RoleName } from '@/domain/roles';
import { initials } from '@/lib/text';

const SELECT = { width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 9px', fontSize: 12.5 } as const;

/** Admins only: roles, access and the properties a house manager or client works with. */
export function TeamTab() {
  const t = useT();
  const showToast = useSessionStore((s) => s.showToast);
  const userId = useSessionStore((s) => s.userId);
  const properties = useEntityStore((s) => s.properties);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    teamRepository.list().then(
      (list) => { if (!cancelled) setMembers(list); },
      (e) => { if (!cancelled) { setMembers([]); showToast(errorText(e, t)); } },
    );
    return () => { cancelled = true; };
  }, [showToast, t]);

  const save = async (next: TeamMember) => {
    const previous = members;
    setMembers((list) => list?.map((m) => (m.id === next.id ? next : m)) ?? list);
    setSavingId(next.id);
    try {
      await teamRepository.save(next);
      showToast(t('toast_saved'));
    } catch (e) {
      setMembers(previous);
      showToast(errorText(e, t));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <div style={{ background: '#FFF8D6', border: '1px solid #FFE88A', borderRadius: 12, padding: '12px 16px', marginBottom: 14, maxWidth: 900, fontSize: 12.5, color: '#6B5300' }}>
        {t('team_invite_hint')}
      </div>
      <div className="tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', maxWidth: 900 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,.7fr)', gap: 11, padding: '12px 20px', background: 'var(--color-bg)', fontSize: 11, color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          <div>{t('col_name')}</div><div>{t('col_role')}</div><div>{t('team_properties')}</div><div>{t('team_access')}</div>
        </div>
        {members === null && <div style={{ padding: 20, fontSize: 13, color: 'var(--color-muted)' }}>{t('dl_loading')}…</div>}
        {members?.map((m) => {
          const scoped = Boolean(ROLES[m.role].scoped || m.role === 'Client');
          const self = m.id === userId;
          const busy = savingId === m.id;
          return (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,.7fr)', gap: 11, padding: '11px 20px', borderTop: '1px solid #F2F2F6', alignItems: 'center', opacity: m.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, flex: 'none', borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials(m.name || m.email)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name || '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                </div>
              </div>
              <select value={m.role} disabled={self || busy} onChange={(e) => void save({ ...m, role: e.target.value as RoleName })} style={SELECT}>
                {ROLE_NAMES.map((r) => <option key={r} value={r}>{t(roleLabelKey(r))}</option>)}
              </select>
              {scoped ? (
                <select
                  multiple
                  value={m.propertyIds}
                  disabled={busy}
                  onChange={(e) => void save({ ...m, propertyIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                  style={{ ...SELECT, height: 74 }}
                >
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--color-faint)' }}>{t('team_all_properties')}</div>
              )}
              <div style={{ textAlign: 'right' }}>
                {!self && (
                  <button
                    className="chip"
                    disabled={busy}
                    onClick={() => void save({ ...m, active: !m.active })}
                    style={{ background: '#fff', border: `1px solid ${m.active ? '#F6CBCB' : 'var(--color-border)'}`, color: m.active ? 'var(--color-red)' : 'var(--color-ink)', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {m.active ? t('team_disable') : t('team_enable')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
