'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useResidentDirectory } from '@/lib/supabase/residents';
import { errorText } from '@/i18n/errors';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { bookingsRepository } from '@/repositories/bookingsRepository';
import { propertyStat } from '@/domain/dashboard';
import { canBookProperty, diffDays, today, addDays } from '@/domain/logic';
import { translatePlace, roomOnly, safeName, TYPE_LABEL_KEY, TYPE_PILL } from '@/domain/labels';
import { SuggestInput, useKnownNames } from '@/components/ui/SuggestInput';
import { formatDateDMY } from '@/lib/format';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';
import { DatePopover } from '@/components/ui/DatePopover';
import { Portal } from '@/components/ui/Portal';
import type { Booking, StayType } from '@/domain/types';
import { backdropClose, useEscape } from '@/lib/useEscape';

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
  const known = useKnownNames();
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const stays = useEntityStore((s) => s.stays);
  const bookings = useEntityStore((s) => s.bookings);
  const residents = useEntityStore((s) => s.residents);

  const [step, setStep] = useState<1 | 2 | 3>(editing ? 2 : 1);
  const [pickMode, setPickMode] = useState(true);
  const [search, setSearch] = useState('');
  const [residentName, setResidentName] = useState(editing?.residentName ?? '');
  const [residentId, setResidentId] = useState<string | null>(editing?.residentId ?? null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [newDob, setNewDob] = useState('');
  const [type, setType] = useState<StayType>(editing?.type ?? 'Internal');
  const [propertyId, setPropertyId] = useState(editing?.propertyId ?? defaultPropertyId ?? '');
  const [manager, setManager] = useState(editing?.manager ?? '');
  const [project, setProject] = useState(editing?.project ?? '');
  const [date, setDate] = useState(editing?.date || addDays(today(), 3));
  const [payer, setPayer] = useState(editing?.payer ?? '');
  const [family, setFamily] = useState(editing?.family ?? false);
  const [discount, setDiscount] = useState(editing?.discount ?? '');
  const [comment, setComment] = useState(editing?.comment ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Closing mid-save would hide its outcome; Escape and the backdrop wait for it.
  const closeUnlessSaving = () => { if (!saving) onClose(); };
  useEscape(closeUnlessSaving);

  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  // Everyone in the database is searchable once a couple of letters are typed, not only who lives here now.
  const directory = useResidentDirectory(search, 1, step === 1 && pickMode && search.trim().length >= 2);

  const residentPool = useMemo(() => {
    const seen = new Set<string>();
    const term = search.trim().toLowerCase();
    const living = activeStays.map((s) => {
      const room = roomsById.get(s.roomId);
      const bed = bedsById.get(s.bedId);
      const property = propertiesById.get(s.propertyId);
      const label = room && bed ? translatePlace(`${roomOnly(room.name)} · Place ${bed.index}`, lang) : '';
      return { id: s.residentId, name: s.residentName, sub: `${property?.name ?? ''} · ${label}` };
    });
    const fromDb = directory.rows.map((r) => ({ id: r.id, name: r.name, sub: [r.phone, r.dob ? formatDateDMY(r.dob) : ''].filter(Boolean).join(' · ') }));
    return [...living, ...fromDb]
      .filter((x) => !term || x.name.toLowerCase().includes(term))
      .filter((x) => !seen.has(x.id) && seen.add(x.id))
      .slice(0, 40);
  }, [activeStays, directory.rows, search, roomsById, bedsById, propertiesById, lang]);

  const propertyOptions = useMemo(
    () =>
      properties.map((p) => {
        const stat = propertyStat(p, rooms, beds, bookings, { excludeBookingId: editing?.id });
        const can = canBookProperty(stat.free, stat.booked);
        return { property: p, stat, can };
      }),
    [properties, rooms, beds, bookings, editing?.id],
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
      // The two-week limit is for new dates; an existing booking keeps its own.
      if (date !== editing?.date && diffDays(today(), date) > 14) return setError(t('err_2weeks'));
      const p = properties.find((x) => x.id === propertyId);
      const stat = p ? propertyStat(p, rooms, beds, bookings, { excludeBookingId: editing?.id }) : null;
      if (stat && !canBookProperty(stat.free, stat.booked)) return setError(t('err_no_places'));
      setStep(3);
      setError('');
      return;
    }
    void save();
  };

  const save = async () => {
    if (saving) return;
    const details = {
      type, propertyId, date, comment, manager, project: project || '—',
      payer: payer || manager, family, discount: discount || null,
    };
    setSaving(true);
    try {
      let saved: Booking;
      if (editing) {
        // Editing changes the details only: status, author and person stay as they were.
        saved = await bookingsRepository.update(editing.id, details);
      } else {
        const picked = pickMode && residentId
          ? residents.find((r) => r.id === residentId) ?? directory.rows.find((r) => r.id === residentId)
          : undefined;
        saved = await bookingsRepository.create(
          {
            ...details,
            residentId: pickMode ? residentId : null,
            residentName: pickMode ? residentName : newName.trim(),
            gender: pickMode ? (picked?.gender ?? null) : newGender === 'Female' ? 'F' : 'M',
            by: profileName,
            status: 'New',
            phone: pickMode ? '' : newPhone.trim(),
            responsible: '',
            children: '',
            registrationNeeded: false,
            payerTenantId: null,
          },
          pickMode ? undefined : newPhone.trim(),
        );
      }
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(errorText(e, t));
      setSaving(false);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
      setError('');
    } else {
      onClose();
    }
  };

  const payerOptions = [...known.managers, 'Client direct', 'Hostel direct'];
  const reviewName = safeName(residentName || '—', !!roleConfig.hideNames, t('hidden_name'));
  const [typeFg, typeBg] = TYPE_PILL[type];

  return (
    <Portal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} {...backdropClose(closeUnlessSaving)}>
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
                      const on = residentId ? residentId === r.id : residentName === r.name;
                      const displayName = safeName(r.name, !!roleConfig.hideNames, t('hidden_name'));
                      return (
                        <div key={r.id} className="rowh" onClick={() => { setResidentName(r.name); setResidentId(r.id); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: '1px solid #F2F2F6', cursor: 'pointer', background: on ? '#FFFBE6' : '#fff' }}>
                          <Avatar name={displayName} size={34} residentId={r.id} />
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
                    <DatePopover value={newDob} onChange={setNewDob} max={today()} />
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
                  <SuggestInput value={manager} onChange={setManager} options={known.managers} />
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{type === 'Internal' ? t('lbl_project') : t('lbl_customer')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  {type === 'Internal' ? (
                    <SuggestInput value={project} onChange={setProject} options={known.projects} />
                  ) : (
                    <select value={project} onChange={(e) => setProject(e.target.value)} style={FIELD_STYLE}>
                      <option value="">{t('select')}</option>
                      <option value="Client direct">{t('d_client')}</option>
                      <option value="Hostel direct">{t('d_hostel')}</option>
                    </select>
                  )}
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{t('wz_expected')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <DatePopover value={date} onChange={setDate} min={editing ? undefined : today()} />
                  <div style={{ fontSize: 10.5, color: 'var(--color-faint)', marginTop: 3 }}>{t('wz_2weeks')}</div>
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{t('wz_payer')}</div>
                  <SuggestInput value={payer} onChange={setPayer} options={payerOptions} />
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
                <Avatar name={reviewName} size={44} residentId={pickMode ? residentId : null} />
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
          <button onClick={goBack} style={{ whiteSpace: 'nowrap', flex: 'none', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', color: 'var(--color-muted)', visibility: step > 1 ? 'visible' : 'hidden' }}>
            {t('wz_back')}
          </button>
          <button className="pbtn" onClick={goNext} disabled={saving} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13.5, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? t('saving') : step < 3 ? t('wz_continue') : editing ? t('wz_save') : t('wz_create')}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
