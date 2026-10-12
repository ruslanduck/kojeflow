'use client';

import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { saveLanguage } from '@/lib/language';
import { useSessionStore } from '@/store/session';
import { createClient } from '@/lib/supabase/client';
import { errorText } from '@/i18n/errors';
import { TeamTab } from './TeamTab';
import { initials } from '@/lib/text';
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

  const isAdmin = useSessionStore((s) => s.actualRole === 'Administrator');
  const [tab, setTab] = useState<'profile' | 'team' | 'system'>('profile');

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [repPw, setRepPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [nameDraft, setNameDraft] = useState(profileName);

  /** Checks the current password by signing in with it, then sets the new one. */
  const savePassword = async () => {
    if (newPw.length < 8) return showToast(t('err_pw_short'));
    if (newPw !== repPw) return showToast(t('err_pw_mismatch'));
    setSavingPw(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) throw new Error('err_signed_out');
      const { error: wrong } = await supabase.auth.signInWithPassword({ email, password: curPw });
      if (wrong) throw new Error('err_pw_current');
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw new Error(error.message);
      setCurPw('');
      setNewPw('');
      setRepPw('');
      showToast(t('toast_pw'));
    } catch (e) {
      showToast(errorText(e, t));
    } finally {
      setSavingPw(false);
    }
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === profileName) return;
    const { error } = await createClient().rpc('set_my_name', { p_name: name });
    if (error) return showToast(error.message);
    setProfileName(name);
    showToast(t('toast_saved'));
  };

  return (
    <section className="screen">
      <MappingNotice items={[{ entity: 'User', field: 'role' }]} />
      <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('set_title')}</h1>
      <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2, marginBottom: 20 }}>{t('set_sub')}</p>

      <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', flexWrap: 'wrap' }}>
        {(isAdmin ? (['profile', 'team', 'system'] as const) : (['profile', 'system'] as const)).map((k) => (
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
            </div>
            <div style={{ marginBottom: 13 }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('set_name')}</div>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={() => void saveName()} onKeyDown={(e) => { if (e.key === 'Enter') void saveName(); }} style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('set_lang')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['EN', 'English'], ['UK', 'Українська']] as [Lang, string][]).map(([code, label]) => (
                  <button key={code} className="pbtn" onClick={() => { setLang(code); saveLanguage(code).catch(() => {}); }} style={{ background: lang === code ? '#141414' : 'var(--color-bg)', color: lang === code ? '#fff' : 'var(--color-ink)', border: '1px solid ' + (lang === code ? '#141414' : 'var(--color-border)'), borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
            <button className="pbtn" onClick={() => void savePassword()} disabled={savingPw} style={{ opacity: savingPw ? 0.6 : 1, background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginTop: 5 }}>
              {t('set_updatepw')}
            </button>
          </div>
        </div>
      )}

      {tab === 'team' && isAdmin && <TeamTab />}

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


    </section>
  );
}
