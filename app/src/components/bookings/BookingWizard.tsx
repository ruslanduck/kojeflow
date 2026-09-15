'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { bookingsRepository } from '@/repositories/bookingsRepository';
import { propertyStat } from '@/domain/dashboard';
import { canBookProperty, diffDays, TODAY, addDays } from '@/domain/logic';
import { translatePlace, safeName, TYPE_LABEL_KEY, TYPE_PILL } from '@/domain/labels';
import { MANAGERS, MANAGER_PROJECTS } from '@/domain/people';
import { formatDateDMY } from '@/lib/format';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';
import { DatePopover } from '@/components/ui/DatePopover';
import { Portal } from '@/components/ui/Portal';
import type { Booking, StayType } from '@/domain/types';

interface BookingWizardProps {
  onClose: () => void;
  editing: Booking | null;
  defaultPropertyId?: string;
  onSaved: (booking: Booking) => void;
}

/**
 * The parent mounts this fresh each time it opens (conditional render + a `key`
 * keyed on the edited booking), so all local state can simply be initialized once
 * from props instead of synced via an effect.
 */
export function BookingWizard({ onClose, editing, defaultPropertyId, onSaved }: BookingWizardProps) {
  const t = useT();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const profileName = useSessionStore((s) => s.profileName);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const stays = useEntityStore((s) => s.stays);

  const [step, setStep] = useState<1 | 2 | 3>(editing ? 2 : 1);
  const [pickMode, setPickMode] = useState(true);
  const [search, setSearch] = useState('');
  const [residentName, setResidentName] = useState(editing?.residentName ?? '');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [newDob, setNewDob] = useState('');
  const [type, setType] = useState<StayType>(editing?.type ?? 'Internal');
  const [propertyId, setPropertyId] = useState(editing?.propertyId ?? defaultPropertyId ?? '');
  const [manager, setManager] = useState(editing?.manager ?? '');
  const [project, setProject] = useState(editing?.project ?? '');
  const [date, setDate] = useState(addDays(TODAY, 3));
  const [payer, setPayer] = useState(editing?.payer ?? '');
  const [family, setFamily] = useState(editing?.family ?? false);
  const [discount, setDiscount] = useState(editing?.discount ?? '');
  const [comment, setComment] = useState(editing?.comment ?? '');
  const [error, setError] = useState('');

  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const residentPool = useMemo(() => {
    const seen = new Set<string>();
    return activeStays
      .filter((s) => !seen.has(s.residentName) && seen.add(s.residentName))
      .filter((s) => !search || s.residentName.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 30)
      .map((s) => {
        const room = roomsById.get(s.roomId);
        const bed = bedsById.get(s.bedId);
        const property = propertiesById.get(s.propertyId);
        const label = room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : '';
        return { name: s.residentName, sub: `${property?.name ?? ''} · ${label}` };
      });
  }, [activeStays, search, roomsById, bedsById, propertiesById, lang]);

  const propertyOptions = useMemo(
    () =>
      properties.map((p) => {
        const stat = propertyStat(p, rooms, beds);
        const can = canBookProperty(stat.free, stat.booked);
        return { property: p, stat, can };
      }),
    [properties, rooms, beds],
  );

  const goNext = () => {
    if (step === 1) {
      const name = pickMode ? residentName : newName.trim();
      if (!name) return setError(pickMode ? t('pay_err_who') : t('err_entername'));
      setResidentName(name);
      setStep(2);
      setError('');
      return;
    }
    if (step === 2) {
      if (!propertyId) return setError(t('err_hostel'));
      if (!manager) return setError(t('err_mgr'));
      if (!project) return setError(t('err_project'));
      if (!date) return setError(t('err_date'));
      if (diffDays(TODAY, date) > 14) return setError(t('err_2weeks'));
      const p = properties.find((x) => x.id === propertyId);
      const stat = p ? propertyStat(p, rooms, beds) : null;
      if (stat && !canBookProperty(stat.free, stat.booked)) return setError(t('err_no_places'));
      setStep(3);
      setError('');
      return;
    }
    void save();
  };

  const save = async () => {
    const name = pickMode ? residentName : newName.trim();
    const payload = {
      residentName: name, type, propertyId, date, comment, by: profileName,
      status: 'New' as const, manager, project: project || '—',
      payer: payer || manager, family, discount: discount || null,
    };
    const saved = editing
      ? await bookingsRepository.update(editing.id, payload)
      : await bookingsRepository.create(payload);
    onSaved(saved);
    onClose();
  };

  const goBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
      setError('');
    } else {
      onClose();
    }
  };

  const managerProjects = MANAGER_PROJECTS[manager] ?? [];
  const projectOptions = type === 'Internal' ? managerProjects : [
    { value: 'Client direct', label: t('d_client') },
    { value: 'Hostel direct', label: t('d_hostel') },
  ];
  const reviewName = safeName(residentName || '—', !!roleConfig.hideNames, t('hidden_name'));
  const [typeFg, typeBg] = TYPE_PILL[type];

  return (
    <Portal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: '100%', maxHeight: '92vh', background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="hd" style={{ fontSize: 23 }}>{editing ? t('wz_edit') : t('wz_new')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-faint)', marginTop: 1 }}>
              {[t('wz_step1'), t('wz_step2'), t('wz_step3')][step - 1]}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--color-faint-2)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 5, padding: '14px 24px 0' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i <= step ? 'var(--color-magenta)' : 'var(--color-border)' }} />
          ))}
        </div>

        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          {step === 1 && (
            <>
              {pickMode ? (
                <>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('wz_search')} style={{ ...FIELD_STYLE, marginBottom: 12 }} />
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 11, maxHeight: 264, overflowY: 'auto' }}>
                    {residentPool.map((r) => {
                      const on = residentName === r.name;
                      const displayName = safeName(r.name, !!roleConfig.hideNames, t('hidden_name'));
                      return (
                        <div key={r.name} className="rowh" onClick={() => { setResidentName(r.name); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: '1px solid #F2F2F6', cursor: 'pointer', background: on ? '#FFFBE6' : '#fff' }}>
                          <Avatar name={displayName} size={34} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{displayName}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--color-faint)' }}>{r.sub}</div>
                          </div>
                          <div style={{ color: 'var(--color-green)', fontWeight: 800, fontSize: 15, opacity: on ? 1 : 0 }}>✓</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={FIELD_LABEL_STYLE}>{t('wz_fullname')}</div>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('ph_entername')} style={FIELD_STYLE} />
                  </div>
                  <div>
                    <div style={FIELD_LABEL_STYLE}>{t('wz_phone')}</div>
                    <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+420 …" style={FIELD_STYLE} />
                  </div>
                  <div>
                    <div style={FIELD_LABEL_STYLE}>{t('wz_gender')}</div>
                    <select value={newGender} onChange={(e) => setNewGender(e.target.value as 'Male' | 'Female')} style={FIELD_STYLE}>
                      <option value="Male">{t('g_male')}</option>
                      <option value="Female">{t('g_female')}</option>
                    </select>
                  </div>
                  <div>
                    <div style={FIELD_LABEL_STYLE}>{t('wz_dob')}</div>
                    <DatePopover value={newDob} onChange={setNewDob} />
                  </div>
                </div>
              )}
              <button
                className="chip"
                onClick={() => { setPickMode(!pickMode); setError(''); }}
                style={{ width: '100%', background: '#fff', border: '1px dashed var(--color-scrollbar)', borderRadius: 9, padding: 11, fontSize: 13, cursor: 'pointer', color: 'var(--color-ink)', fontWeight: 600, marginTop: 12 }}
              >
                {pickMode ? t('wz_createnew') : t('wz_backlist')}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, marginBottom: 16 }}>
                {(['Internal', 'Commercial'] as const).map((k) => (
                  <button key={k} className="pbtn" onClick={() => { setType(k); setError(''); }} style={{ flex: 1, background: type === k ? '#141414' : 'transparent', color: type === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {t(TYPE_LABEL_KEY[k])}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 6 }}>
                {t('wz_pickhostel')} <span style={{ color: 'var(--color-red)' }}>*</span>
              </div>
              <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginBottom: 15, maxHeight: 172, overflowY: 'auto' }}>
                {propertyOptions.map(({ property, stat, can }) => {
                  const on = propertyId === property.id;
                  return (
                    <div
                      key={property.id}
                      onClick={() => { if (!can) return setError(t('err_no_places')); setPropertyId(property.id); setError(''); }}
                      style={{ border: `1px solid ${on ? '#141414' : 'var(--color-border)'}`, background: on ? '#FAFAFB' : can ? '#fff' : '#FAFAFC', borderRadius: 10, padding: '10px 12px', cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : 0.55 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{property.name}</span>
                        <Pill label={can ? t('badge_available') : t('badge_full')} fg={can ? '#1B7F52' : '#C0392B'} bg={can ? '#E4F6EC' : '#FDECEC'} />
                      </div>
                      <div className="num" style={{ fontSize: 11, color: 'var(--color-faint)', marginTop: 3 }}>
                        {stat.free} {t('free').toLowerCase()} · {stat.booked} {t('booked_place').toLowerCase()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{type === 'Internal' ? t('lbl_manager') : t('lbl_responsible')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <select value={manager} onChange={(e) => { setManager(e.target.value); setProject(''); }} style={FIELD_STYLE}>
                    <option value="">{t('select')}</option>
                    {MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{type === 'Internal' ? t('lbl_project') : t('lbl_customer')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <select value={project} onChange={(e) => setProject(e.target.value)} style={FIELD_STYLE}>
                    <option value="">{t('select')}</option>
                    {type === 'Internal'
                      ? managerProjects.map((p) => <option key={p} value={p}>{p}</option>)
                      : (projectOptions as { value: string; label: string }[]).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{t('wz_expected')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <DatePopover value={date} onChange={setDate} />
                  <div style={{ fontSize: 10.5, color: 'var(--color-faint)', marginTop: 3 }}>{t('wz_2weeks')}</div>
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{t('wz_payer')}</div>
                  <select value={payer} onChange={(e) => setPayer(e.target.value)} style={FIELD_STYLE}>
                    <option value="">{t('select')}</option>
                    {MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value="Client direct">{t('d_client')}</option>
                    <option value="Hostel direct">{t('d_hostel')}</option>
                  </select>
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{t('wz_discount')}</div>
                  <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder={t('wz_disc_ph')} style={FIELD_STYLE} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={FIELD_LABEL_STYLE}>{t('wz_comment')}</div>
                  <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('wz_optnote')} style={FIELD_STYLE} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 13 }}>
                <input type="checkbox" checked={family} onChange={(e) => setFamily(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#141414' }} />
                {t('wz_family')}
              </label>
            </>
          )}

          {step === 3 && (
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 19 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15, paddingBottom: 15, borderBottom: '1px solid var(--color-border)' }}>
                <Avatar name={reviewName} size={44} />
                <div>
                  <div className="hd" style={{ fontSize: 19 }}>{reviewName}</div>
                  <Pill label={t(TYPE_LABEL_KEY[type])} fg={typeFg} bg={typeBg} />
                </div>
              </div>
              <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 13 }}>
                {[
                  { k: t('ff_hostel'), v: propertiesById.get(propertyId)?.name ?? '—' },
                  { k: t('wz_expected'), v: formatDateDMY(date) },
                  { k: t('lbl_manager'), v: manager || '—' },
                  { k: type === 'Internal' ? t('lbl_project') : t('lbl_customer'), v: project || '—' },
                  { k: t('exp_payer'), v: payer || manager || '—' },
                  { k: t('exp_family'), v: family ? t('yes') : t('no') },
                  { k: t('exp_discount'), v: discount || '—' },
                  { k: t('exp_comment'), v: comment || '—' },
                ].map((row) => (
                  <div key={row.k}>
                    <div style={{ fontSize: 10, color: 'var(--color-faint)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{row.k}</div>
                    <div style={{ fontSize: 13, marginTop: 3 }}>{row.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#FDECEC', border: '1px solid #F6CBCB', color: '#C0392B', borderRadius: 9, padding: '11px 14px', fontSize: 12.5, marginTop: 13, fontWeight: 500 }}>{error}</div>
          )}
        </div>

        <div style={{ padding: '15px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={goBack} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', color: 'var(--color-muted)', visibility: step > 1 ? 'visible' : 'hidden' }}>
            {t('wz_back')}
          </button>
          <button className="pbtn" onClick={goNext} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            {step < 3 ? t('wz_continue') : editing ? t('wz_save') : t('wz_create')}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
