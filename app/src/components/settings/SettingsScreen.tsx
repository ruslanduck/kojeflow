'use client';

import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { usersRepository } from '@/repositories/usersRepository';
import { ROLE_NAMES, roleLabelKey, type RoleName } from '@/domain/roles';
import { initials } from '@/lib/text';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency } from '@/lib/format';
import type { Lang } from '@/i18n';
import { MappingNotice } from '@/components/ui/Unmapped';

const CURRENCIES = ['$', '€', '₴', 'Kč', 'zł'];

export function SettingsScreen() {
  const t = useT();
  const lang = useSessionStore((s) => s.lang);
  const setLang = useSessionStore((s) => s.setLang);
  const profileName = useSessionStore((s) => s.profileName);
  const setProfileName = useSessionStore((s) => s.setProfileName);
  const currency = useSessionStore((s) => s.currency);
  const setCurrency = useSessionStore((s) => s.setCurrency);
  const showToast = useSessionStore((s) => s.showToast);

  const users = useEntityStore((s) => s.users);

  const [tab, setTab] = useState<'profile' | 'team' | 'system'>('profile');
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [repPw, setRepPw] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleName>('Commandant');

  const savePassword = () => {
    if (!newPw || newPw !== repPw) return showToast('Passwords do not match');
    setCurPw('');
    setNewPw('');
    setRepPw('');
    showToast(t('toast_pw'));
  };

  const sendInvite = async () => {
    if (!/@/.test(inviteEmail)) return showToast('Enter a valid e-mail');
    const name = inviteEmail
      .split('@')[0]
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    await usersRepository.create({ name, email: inviteEmail, role: inviteRole });
    setInviteEmail('');
    showToast(t('toast_invite', { e: inviteEmail }));
  };

  const changeUserRole = async (userId: string, role: string) => {
    await usersRepository.update(userId, { role });
  };
  const removeUser = async (userId: string, name: string) => {
    await usersRepository.remove(userId);
    setConfirmRemove(null);
    showToast(t('toast_removed', { n: name }));
  };

  return (
    <section className="screen">
      <MappingNotice items={[{ entity: 'User', field: 'role' }]} />
      <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('set_title')}</h1>
      <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2, marginBottom: 20 }}>{t('set_sub')}</p>

      <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', flexWrap: 'wrap' }}>
        {(['profile', 'team', 'system'] as const).map((k) => (
          <button key={k} className="pbtn" onClick={() => setTab(k)} style={{ background: tab === k ? '#141414' : 'transparent', color: tab === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {k === 'profile' ? t('tab_profile') : k === 'team' ? t('tab_team') : t('tab_system')}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, maxWidth: 900 }}>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: 20 }}>
            <h3 className="hd" style={{ fontSize: 17, marginBottom: 15 }}>{t('set_profile')}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 60, height: 60, flex: 'none', borderRadius: '50%', background: 'var(--color-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--color-ink)' }}>
                {initials(profileName)}
              </div>
              <button className="chip" onClick={() => showToast(t('toast_avatar'))} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 15px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                {t('set_avatar')}
              </button>
            </div>
            <div style={{ marginBottom: 13 }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('set_name')}</div>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('set_lang')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['EN', 'English'], ['UK', 'Українська']] as [Lang, string][]).map(([code, label]) => (
                  <button key={code} className="pbtn" onClick={() => setLang(code)} style={{ background: lang === code ? '#141414' : 'var(--color-bg)', color: lang === code ? '#fff' : 'var(--color-ink)', border: '1px solid ' + (lang === code ? '#141414' : 'var(--color-border)'), borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: 20 }}>
            <h3 className="hd" style={{ fontSize: 17, marginBottom: 15 }}>{t('set_password')}</h3>
            {[
              { label: t('set_pw_cur'), value: curPw, onChange: setCurPw },
              { label: t('set_pw_new'), value: newPw, onChange: setNewPw },
              { label: t('set_pw_rep'), value: repPw, onChange: setRepPw },
            ].map((f) => (
              <div key={f.label} style={{ marginBottom: 11 }}>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{f.label}</div>
                <input type="password" value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder="••••••••" style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
              </div>
            ))}
            <button className="pbtn" onClick={savePassword} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginTop: 5 }}>
              {t('set_updatepw')}
            </button>
          </div>
        </div>
      )}

      {tab === 'team' && (
        <>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: 20, marginBottom: 14, maxWidth: 900 }}>
            <h3 className="hd" style={{ fontSize: 17, marginBottom: 14 }}>{t('set_invite')}</h3>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@company.com" style={{ flex: 2, minWidth: 200, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '11px 13px', fontSize: 13.5, outline: 'none' }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as RoleName)} style={{ flex: 1, minWidth: 160, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '11px 32px 11px 13px', fontSize: 13.5, outline: 'none' }}>
                {ROLE_NAMES.map((r) => <option key={r} value={r}>{t(roleLabelKey(r))}</option>)}
              </select>
              <button className="pbtn" onClick={() => void sendInvite()} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {t('set_send')}
              </button>
            </div>
          </div>
          <div className="tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', maxWidth: 900 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1.8fr) minmax(0,1.4fr) minmax(0,.6fr)', gap: 11, padding: '12px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 10.5, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              <div>{t('col_name')}</div><div>{t('col_email')}</div><div>{t('col_role')}</div><div></div>
            </div>
            {users.map((u) => (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1.8fr) minmax(0,1.4fr) minmax(0,.6fr)', gap: 11, padding: '11px 20px', borderBottom: '1px solid #F2F2F6', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 30, height: 30, flex: 'none', borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12 }}>{initials(u.name)}</div>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{u.email}</div>
                <div>
                  <select value={u.role} onChange={(e) => void changeUserRole(u.id, e.target.value)} style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 28px 7px 10px', fontSize: 12.5, outline: 'none' }}>
                    {ROLE_NAMES.map((r) => <option key={r} value={r}>{t(roleLabelKey(r))}</option>)}
                  </select>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="chip" onClick={() => setConfirmRemove({ id: u.id, name: u.name })} style={{ background: '#fff', border: '1px solid #F6CBCB', borderRadius: 8, padding: '6px 11px', fontSize: 12, cursor: 'pointer', color: 'var(--color-red)' }}>
                    {t('remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'system' && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: 20, maxWidth: 520 }}>
          <h3 className="hd" style={{ fontSize: 17, marginBottom: 6 }}>{t('set_currency')}</h3>
          <p style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 14 }}>{t('set_currency_hint')}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CURRENCIES.map((c) => (
              <button key={c} className="pbtn" onClick={() => { setCurrency(c); showToast(t('toast_currency', { c })); }} style={{ background: currency === c ? '#141414' : 'var(--color-bg)', color: currency === c ? '#fff' : 'var(--color-ink)', border: '1px solid ' + (currency === c ? '#141414' : 'var(--color-border)'), borderRadius: 9, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 56 }}>
                {c}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #F2F2F6' }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 4 }}>{t('set_preview')}</div>
            <div className="fig" style={{ fontSize: 26 }}>{formatCurrency(128450, currency)}</div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title={t('remove_member_title')}
          sub={t('remove_member_confirm', { n: confirmRemove.name })}
          confirmLabel={t('remove')}
          cancelLabel={t('keep_member')}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => void removeUser(confirmRemove.id, confirmRemove.name)}
        />
      )}
    </section>
  );
}
