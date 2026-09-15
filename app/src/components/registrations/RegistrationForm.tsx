'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { registrationsRepository } from '@/repositories/registrationsRepository';
import { safeName } from '@/domain/labels';
import { TODAY, addDays } from '@/domain/logic';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';
import { DatePopover } from '@/components/ui/DatePopover';
import { Portal } from '@/components/ui/Portal';
import type { Registration, RegistrationStatus, RegistrationType } from '@/domain/types';

const COORDINATORS = ['Turok', 'Vakarov'];

interface RegistrationFormProps {
  onClose: () => void;
  editing: Registration | null;
  onSaved: (registration: Registration) => void;
}

export function RegistrationForm({ onClose, editing, onSaved }: RegistrationFormProps) {
  const t = useT();
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const stays = useEntityStore((s) => s.stays);

  const [pickMode, setPickMode] = useState(true);
  const [search, setSearch] = useState('');
  const [residentName, setResidentName] = useState(editing?.residentName ?? '');
  const [newName, setNewName] = useState('');
  const [type, setType] = useState<RegistrationType>(editing?.type ?? 'Free');
  const [propertyId, setPropertyId] = useState(editing?.propertyId ?? '');
  const [coordinator, setCoordinator] = useState(editing?.coordinator ?? COORDINATORS[0]);
  const [status, setStatus] = useState<RegistrationStatus>(editing?.status ?? 'New');
  const [issued, setIssued] = useState(editing?.issued ?? TODAY);
  const [expires, setExpires] = useState(editing?.expires ?? addDays(TODAY, 90));
  const [docs, setDocs] = useState(editing?.docs ?? 0);
  const [error, setError] = useState('');

  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);
  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const residentPool = useMemo(() => {
    const seen = new Set<string>();
    return activeStays
      .filter((s) => !seen.has(s.residentName) && seen.add(s.residentName))
      .filter((s) => !search || s.residentName.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 30)
      .map((s) => ({ name: s.residentName, propertyId: s.propertyId, sub: propertiesById.get(s.propertyId)?.name ?? '' }));
  }, [activeStays, search, propertiesById]);

  const attachDoc = () => setDocs((d) => d + 1);

  const save = async () => {
    const name = pickMode ? residentName : newName.trim();
    if (!name) return setError(t('pay_err_who'));
    if (!propertyId) return setError(t('err_hostel'));
    if (!expires) return setError(t('err_date'));
    const payload = { residentName: name, type, status, propertyId, coordinator, issued, expires, docs };
    const saved = editing ? await registrationsRepository.update(editing.id, payload) : await registrationsRepository.create(payload);
    onSaved(saved);
  };

  const displayName = safeName(residentName || '—', !!roleConfig.hideNames, t('hidden_name'));

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 61, padding: 16 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: '100%', maxHeight: '92vh', background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="hd" style={{ fontSize: 23 }}>{editing ? `${t('form_edit')} · ${t('rg_title')}` : t('rg_new')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-faint)', marginTop: 1 }}>{t('rg_form_sub')}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--color-faint-2)', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 6 }}>{t('rg_resident')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
            {pickMode ? (
              <>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('wz_search')} style={{ ...FIELD_STYLE, marginBottom: 10 }} />
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 11, maxHeight: 184, overflowY: 'auto', marginBottom: 11 }}>
                  {residentPool.map((r) => {
                    const on = residentName === r.name;
                    const rowName = safeName(r.name, !!roleConfig.hideNames, t('hidden_name'));
                    return (
                      <div key={r.name} className="rowh" onClick={() => { setResidentName(r.name); setPropertyId((p) => p || r.propertyId); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', borderBottom: '1px solid #F2F2F6', cursor: 'pointer', background: on ? '#FFFBE6' : '#fff' }}>
                        <Avatar name={rowName} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{rowName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--color-faint)' }}>{r.sub}</div>
                        </div>
                        <div style={{ color: 'var(--color-green)', fontWeight: 800, fontSize: 15, opacity: on ? 1 : 0 }}>✓</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('ph_entername')} style={{ ...FIELD_STYLE, marginBottom: 11 }} />
            )}
            <button className="chip" onClick={() => setPickMode(!pickMode)} style={{ width: '100%', background: '#fff', border: '1px dashed var(--color-scrollbar)', borderRadius: 9, padding: 10, fontSize: 12.5, cursor: 'pointer', color: 'var(--color-ink)', fontWeight: 600, marginBottom: 16 }}>
              {pickMode ? t('wz_createnew') : t('wz_backlist')}
            </button>

            <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('ff_type')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                <select value={type} onChange={(e) => setType(e.target.value as RegistrationType)} style={FIELD_STYLE}>
                  <option value="Free">{t('type_Free')}</option>
                  <option value="Paid">{t('type_Paid')}</option>
                </select>
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('ff_hostel')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={FIELD_STYLE}>
                  <option value="">{t('select')}</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('ff_visa')}</div>
                <select value={coordinator} onChange={(e) => setCoordinator(e.target.value)} style={FIELD_STYLE}>
                  {COORDINATORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('ff_status')}</div>
                <select value={status} onChange={(e) => setStatus(e.target.value as RegistrationStatus)} style={FIELD_STYLE}>
                  <option value="New">{t('st_New')}</option>
                  <option value="Registered">{t('st_Registered')}</option>
                  <option value="Expired">{t('st_Expired')}</option>
                </select>
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('col_issued')}</div>
                <DatePopover value={issued} onChange={setIssued} />
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('col_expires')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                <DatePopover value={expires} onChange={setExpires} />
              </div>
            </div>

            <button
              className="chip"
              onClick={attachDoc}
              style={{ width: '100%', marginTop: 15, background: '#fff', border: '1px dashed var(--color-scrollbar)', borderRadius: 9, padding: 11, fontSize: 13, cursor: 'pointer', color: 'var(--color-ink)', fontWeight: 600 }}
            >
              {docs ? t('rg_docs_n', { n: docs }) : t('rg_add_docs')}
            </button>

            {error && (
              <div style={{ background: '#FDECEC', border: '1px solid #F6CBCB', color: '#C0392B', borderRadius: 9, padding: '11px 14px', fontSize: 12.5, marginTop: 13, fontWeight: 500 }}>{error}</div>
            )}
            {residentName && (
              <div style={{ marginTop: 15, fontSize: 12, color: 'var(--color-faint)' }}>{t('rg_resident')}: <strong style={{ color: 'var(--color-ink)' }}>{displayName}</strong></div>
            )}
          </div>
          <div style={{ padding: '15px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', color: 'var(--color-muted)' }}>{t('cancel')}</button>
            <button className="pbtn" onClick={() => void save()} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{t('save')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
