'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { checkIn, resolveResident } from '@/repositories/operations';
import { bookingsRepository } from '@/repositories/bookingsRepository';
import { translatePlace, safeName, TYPE_LABEL_KEY, ROOM_GENDER_LABEL_KEY, ROOM_GENDER_PILL, DEFAULT_PILL } from '@/domain/labels';
import { roomGender, TODAY } from '@/domain/logic';
import { MANAGERS, MANAGER_PROJECTS } from '@/domain/people';
import { formatCurrency, formatDateDMY } from '@/lib/format';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';
import { DatePopover } from '@/components/ui/DatePopover';
import { Portal } from '@/components/ui/Portal';
import type { Booking, Stay, StayType } from '@/domain/types';

interface CheckInWizardProps {
  onClose: () => void;
  fromBooking: Booking | null;
  defaultPropertyId?: string;
  onSaved: (stays: Stay[]) => void;
}

export function CheckInWizard({ onClose, fromBooking, defaultPropertyId, onSaved }: CheckInWizardProps) {
  const t = useT();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const showToast = useSessionStore((s) => s.showToast);
  const currency = useSessionStore((s) => s.currency);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const residents = useEntityStore((s) => s.residents);
  const stays = useEntityStore((s) => s.stays);
  const bookings = useEntityStore((s) => s.bookings);

  const [step, setStep] = useState<1 | 2 | 3>(fromBooking ? 2 : 1);
  const [pickMode, setPickMode] = useState(true);
  const [search, setSearch] = useState('');
  const [residentName, setResidentName] = useState(fromBooking?.residentName ?? '');
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [propertyId, setPropertyId] = useState(fromBooking?.propertyId ?? defaultPropertyId ?? '');
  const [roomId, setRoomId] = useState('');
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>(defaultPropertyId ? [] : []);
  const [type, setType] = useState<StayType>(fromBooking?.type ?? 'Internal');
  const [manager, setManager] = useState(fromBooking?.manager ?? '');
  const [project, setProject] = useState(fromBooking?.project ?? '');
  const [date, setDate] = useState(TODAY);
  const [family, setFamily] = useState(fromBooking?.family ?? false);
  const [error, setError] = useState('');

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const residentsById = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);

  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);

  const residentPool = useMemo(() => {
    const awaiting = bookings
      .filter((b) => b.status === 'New')
      .map((b) => ({ name: b.residentName, sub: `${propertiesById.get(b.propertyId)?.name ?? ''} · ${t('wz_expected')} ${formatDateDMY(b.date)}` }));
    const living = activeStays.map((s) => {
      const room = roomsById.get(s.roomId);
      const bed = bedsById.get(s.bedId);
      const label = room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : '';
      return { name: s.residentName, sub: `${propertiesById.get(s.propertyId)?.name ?? ''} · ${label}` };
    });
    const seen = new Set<string>();
    return [...awaiting, ...living]
      .filter((x) => !seen.has(x.name) && seen.add(x.name))
      .filter((x) => !search || x.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 30);
  }, [bookings, activeStays, roomsById, bedsById, propertiesById, lang, search, t]);

  const propertyRooms = useMemo(() => rooms.filter((r) => r.propertyId === propertyId), [rooms, propertyId]);
  const roomOptions = propertyRooms.map((r) => {
    const freeCount = beds.filter((b) => b.roomId === r.id && b.status === 'free').length;
    return { room: r, label: `${translatePlace(r.name, lang)} — ${freeCount} ${t('free').toLowerCase()}` };
  });
  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null;
  const roomBeds = selectedRoom ? beds.filter((b) => b.roomId === selectedRoom.id).sort((a, b) => a.index - b.index) : [];
  const roomG = selectedRoom ? roomGender(roomBeds, residentsById) : 'N';
  const [roomGFg, roomGBg] = ROOM_GENDER_PILL[roomG] ?? DEFAULT_PILL;

  const managerProjects = MANAGER_PROJECTS[manager] ?? [];
  const projectOptions = type === 'Internal' ? managerProjects.map((p) => ({ value: p, label: p })) : [
    { value: 'Client direct', label: t('d_client') },
    { value: 'Hostel direct', label: t('d_hostel') },
  ];

  const goNext = async () => {
    if (step === 1) {
      const name = pickMode ? residentName : newName.trim();
      if (!name) return setError(t('ph_entername'));
      setResidentName(name);
      setStep(2);
      setError('');
      return;
    }
    if (step === 2) {
      if (!propertyId) return setError(t('err_hostel'));
      if (!roomId) return setError(t('room'));
      if (selectedBedIds.length === 0) return setError(t('err_no_places'));
      setStep(3);
      setError('');
      return;
    }
    if (!manager) return setError(t('err_mgr'));
    if (!project) return setError(t('err_project'));

    const gender: 'M' | 'F' = pickMode ? residentsById.get(residents.find((r) => r.name === residentName)?.id ?? '')?.gender ?? 'M' : newGender === 'Female' ? 'F' : 'M';
    const residentId = await resolveResident(residentName, gender);
    const created: Stay[] = [];
    for (const bedId of selectedBedIds) {
      const bed = beds.find((b) => b.id === bedId);
      if (!bed) continue;
      const stay = await checkIn({ residentId, residentName, propertyId, roomId, bedId, type, manager, project, checkIn: date });
      created.push(stay);
    }
    if (fromBooking) await bookingsRepository.update(fromBooking.id, { status: 'Checked-in' });
    showToast(t('toast_ci', { n: residentName, p: selectedRoom ? translatePlace(selectedRoom.name, lang) : '' }));
    onSaved(created);
  };

  const goBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
      setError('');
    } else {
      onClose();
    }
  };

  const toggleBed = (bedId: string, status: string) => {
    if (status !== 'free') {
      showToast(status === 'booked' ? t('booked_tip') : t('occ_place'));
      return;
    }
    setSelectedBedIds((prev) => (prev.includes(bedId) ? prev.filter((x) => x !== bedId) : [...prev, bedId]));
  };

  const reviewName = safeName(residentName || '—', !!roleConfig.hideNames, t('hidden_name'));
  const reviewPlace = selectedRoom ? `${translatePlace(selectedRoom.name, lang)} · ${selectedBedIds.map((id) => bedsById.get(id)?.index).join(', ')}` : '—';

  return (
    <Portal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 61, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 680, maxWidth: '100%', maxHeight: '92vh', background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="hd" style={{ fontSize: 23 }}>{t('ci_new')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-faint)', marginTop: 1 }}>{[t('ci_step1'), t('ci_step2'), t('ci_step3')][step - 1]}</div>
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
                    <div style={FIELD_LABEL_STYLE}>{t('wz_gender')}</div>
                    <select value={newGender} onChange={(e) => setNewGender(e.target.value as 'Male' | 'Female')} style={FIELD_STYLE}>
                      <option value="Male">{t('g_male')}</option>
                      <option value="Female">{t('g_female')}</option>
                    </select>
                  </div>
                </div>
              )}
              <button className="chip" onClick={() => { setPickMode(!pickMode); setError(''); }} style={{ width: '100%', background: '#fff', border: '1px dashed var(--color-scrollbar)', borderRadius: 9, padding: 11, fontSize: 13, cursor: 'pointer', color: 'var(--color-ink)', fontWeight: 600, marginTop: 12 }}>
                {pickMode ? t('wz_createnew') : t('wz_backlist')}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: 'flex', gap: 11, marginBottom: 15, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={FIELD_LABEL_STYLE}>{t('hostel')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setRoomId(''); setSelectedBedIds([]); setError(''); }} style={FIELD_STYLE}>
                    <option value="">{t('select')}</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={FIELD_LABEL_STYLE}>{t('room')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <select value={roomId} onChange={(e) => { setRoomId(e.target.value); setSelectedBedIds([]); setError(''); }} style={FIELD_STYLE}>
                    <option value="">{t('select')}</option>
                    {roomOptions.map((o) => <option key={o.room.id} value={o.room.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {selectedRoom && (
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 15 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
                    <span className="hd" style={{ fontSize: 16 }}>{translatePlace(selectedRoom.name, lang)}</span>
                    <Pill label={t(ROOM_GENDER_LABEL_KEY[roomG])} fg={roomGFg} bg={roomGBg} />
                    <span className="num" style={{ fontSize: 11.5, color: 'var(--color-muted)', marginLeft: 'auto' }}>
                      {formatCurrency(selectedRoom.priceFrom, currency)}–{formatCurrency(selectedRoom.priceTo, currency)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {roomBeds.map((bed) => {
                      const sel = selectedBedIds.includes(bed.id);
                      const colors = bed.status === 'free'
                        ? (sel ? ['#141414', '#141414', '#FFD600'] : ['#E4F6EC', '#B7E4CB', '#1B7F52'])
                        : bed.status === 'booked' ? ['#FFFBE6', '#FFE88A', '#8A6B00'] : ['#F1F1F5', '#E2E2EA', '#5C5C66'];
                      return (
                        <div
                          key={bed.id}
                          className="bed"
                          onClick={() => toggleBed(bed.id, bed.status)}
                          title={bed.status === 'occupied' && bed.residentId ? safeName(residentsById.get(bed.residentId)?.name ?? '', !!roleConfig.hideNames, t('hidden_name')) : bed.status === 'booked' ? t('booked_place') : t('free_place')}
                          style={{ minWidth: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, cursor: bed.status === 'free' ? 'pointer' : 'not-allowed', background: colors[0], border: `1px solid ${colors[1]}`, color: colors[2] }}
                        >
                          {bed.index}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 11 }}>{t('ci_pick_hint')}</div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, marginBottom: 16 }}>
                {(['Internal', 'Commercial'] as const).map((k) => (
                  <button key={k} className="pbtn" onClick={() => { setType(k); setError(''); }} style={{ flex: 1, background: type === k ? '#141414' : 'transparent', color: type === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {t(TYPE_LABEL_KEY[k])}
                  </button>
                ))}
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
                    {projectOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{t('ff_checkin')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <DatePopover value={date} onChange={setDate} />
                </div>
                <div>
                  <div style={FIELD_LABEL_STYLE}>{t('wz_family')}</div>
                  <select value={family ? 'yes' : 'no'} onChange={(e) => setFamily(e.target.value === 'yes')} style={FIELD_STYLE}>
                    <option value="no">{t('no')}</option>
                    <option value="yes">{t('yes')}</option>
                  </select>
                </div>
              </div>
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 11, padding: 14, marginTop: 15 }}>
                <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                  {[
                    { k: t('rg_resident'), v: reviewName },
                    { k: t('ff_hostel'), v: propertiesById.get(propertyId)?.name ?? '—' },
                    { k: t('pm_roomplace'), v: reviewPlace },
                    { k: t('ff_type'), v: t(TYPE_LABEL_KEY[type]) },
                  ].map((row) => (
                    <div key={row.k}>
                      <div style={{ fontSize: 10, color: 'var(--color-faint)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{row.k}</div>
                      <div style={{ fontSize: 13, marginTop: 3, fontWeight: 500 }}>{row.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div style={{ background: '#FDECEC', border: '1px solid #F6CBCB', color: '#C0392B', borderRadius: 9, padding: '11px 14px', fontSize: 12.5, marginTop: 13, fontWeight: 500 }}>{error}</div>
          )}
        </div>

        <div style={{ padding: '15px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={goBack} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', color: 'var(--color-muted)', visibility: step > 1 ? 'visible' : 'hidden' }}>
            {t('wz_back')}
          </button>
          <button className="pbtn" onClick={() => void goNext()} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            {step < 3 ? t('wz_continue') : t('ci_confirm')}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
