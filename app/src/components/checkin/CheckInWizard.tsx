'use client';

import { useMemo, useRef, useState } from 'react';
import { useT } from '@/i18n/useT';
import { errorText } from '@/i18n/errors';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { checkIn, rateForBeds } from '@/repositories/operations';
import { residentsRepository } from '@/repositories/residentsRepository';
import { translatePlace, roomOnly, safeName, TYPE_LABEL_KEY, ROOM_GENDER_LABEL_KEY, ROOM_GENDER_PILL, DEFAULT_PILL, BED_TILE_COLORS, GENDER_EMOJI } from '@/domain/labels';
import { roomGender, today } from '@/domain/logic';
import { formatCurrency, formatDateDMY } from '@/lib/format';
import { extractPortrait } from '@/lib/passportPhoto';
import { useResidentDirectory } from '@/lib/supabase/residents';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';
import { DatePopover } from '@/components/ui/DatePopover';
import { Portal } from '@/components/ui/Portal';
import { SuggestInput, useKnownNames } from '@/components/ui/SuggestInput';
import type { Bed, Booking, Gender, Room, RoomType, Stay, StayType } from '@/domain/types';
import { useEscape } from '@/lib/useEscape';

interface CheckInWizardProps {
  onClose: () => void;
  fromBooking: Booking | null;
  defaultPropertyId?: string;
  /** Pre-selected place, e.g. when check-in starts from a free bed on the dashboard. */
  defaultRoomId?: string;
  defaultBedIds?: string[];
  onSaved: (stays: Stay[]) => void;
}

/** Who is checking in: someone already known (by id when we have it) or a new person. */
interface PickedPerson {
  id?: string;
  name: string;
  sub: string;
  /** Picked from an open booking: checking in closes it and takes its gender and discount. */
  booking?: Booking;
}

const GROUP_ORDER: RoomType[] = ['Room', 'Apartment', 'Wagon'];

export function CheckInWizard({ onClose, fromBooking, defaultPropertyId, defaultRoomId, defaultBedIds, onSaved }: CheckInWizardProps) {
  useEscape(onClose);
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
  const known = useKnownNames();

  const [step, setStep] = useState<1 | 2 | 3>(fromBooking ? 2 : 1);
  const [pickMode, setPickMode] = useState(true);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<PickedPerson | null>(fromBooking ? { id: fromBooking.residentId ?? undefined, name: fromBooking.residentName, sub: '', booking: fromBooking } : null);
  // A resident created by a failed attempt is reused on retry, not created again with all their files.
  const createdResident = useRef<{ id: string; name: string } | null>(null);

  // new person
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<Gender>('M');
  const [newPhone, setNewPhone] = useState('');
  const [newDob, setNewDob] = useState('');
  const [passportFiles, setPassportFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [portrait, setPortrait] = useState<{ blob: Blob; url: string } | null>(null);
  const [cropping, setCropping] = useState(false);

  const [propertyId, setPropertyId] = useState(fromBooking?.propertyId ?? defaultPropertyId ?? '');
  const [roomId, setRoomId] = useState(defaultRoomId ?? '');
  const [selectedBedIds, setSelectedBedIds] = useState<string[]>(defaultBedIds ?? []);
  const [type, setType] = useState<StayType>(fromBooking?.type ?? 'Internal');
  const [manager, setManager] = useState(fromBooking?.manager ?? '');
  const [project, setProject] = useState(fromBooking?.project && fromBooking.project !== '—' ? fromBooking.project : '');
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const residentsById = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);

  // Everyone in the database is searchable once a couple of letters are typed.
  const directory = useResidentDirectory(search, 1, step === 1 && pickMode && search.trim().length >= 2);

  const pool = useMemo((): PickedPerson[] => {
    // Bookings for the property being checked into come first.
    const here = defaultPropertyId ?? propertyId;
    const awaiting = bookings
      .filter((b) => b.status === 'New')
      .sort((a, b) => Number(b.propertyId === here) - Number(a.propertyId === here))
      .map((b): PickedPerson => ({ id: b.residentId ?? undefined, name: b.residentName, booking: b, sub: `${propertiesById.get(b.propertyId)?.name ?? ''} · ${t('wz_expected')} ${formatDateDMY(b.date)}` }));
    const living = activeStays.map((s) => {
      const room = roomsById.get(s.roomId);
      const bed = bedsById.get(s.bedId);
      const label = room && bed ? translatePlace(`${roomOnly(room.name)} · Place ${bed.index}`, lang) : '';
      return { id: s.residentId, name: s.residentName, sub: `${propertiesById.get(s.propertyId)?.name ?? ''} · ${label}` };
    });
    const fromDb = directory.rows.map((r) => ({ id: r.id, name: r.name, sub: [r.phone, r.dob ? formatDateDMY(r.dob) : ''].filter(Boolean).join(' · ') }));
    const term = search.trim().toLowerCase();
    const seen = new Set<string>();
    return ([...awaiting, ...living, ...fromDb] as PickedPerson[])
      .filter((x) => !term || x.name.toLowerCase().includes(term))
      .filter((x) => {
        const key = x.booking ? `booking:${x.booking.id}` : x.id ?? `name:${x.name}`;
        return !seen.has(key) && seen.add(key);
      })
      .slice(0, 40);
  }, [defaultPropertyId, propertyId, bookings, activeStays, directory.rows, roomsById, bedsById, propertiesById, lang, search, t]);

  const propertyRooms = useMemo(() => rooms.filter((r) => r.propertyId === propertyId), [rooms, propertyId]);
  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null;
  const freeInProperty = beds.filter((b) => b.propertyId === propertyId && b.status === 'free').length;

  const pickBed = (room: Room, bedId: string, status: string) => {
    if (status !== 'free') {
      showToast(status === 'unavailable' ? t('unavail_tip') : t('occ_place'));
      return;
    }
    setError('');
    // One stay lives in one room: picking a bed elsewhere starts a new selection there.
    if (room.id !== roomId) {
      setRoomId(room.id);
      setSelectedBedIds([bedId]);
      return;
    }
    setSelectedBedIds((prev) => (prev.includes(bedId) ? prev.filter((x) => x !== bedId) : [...prev, bedId]));
  };

  const cropPortrait = async () => {
    if (!passportFiles.length) return showToast(t('ai_needscan'));
    setCropping(true);
    try {
      const blob = await extractPortrait(passportFiles[0]);
      if (portrait) URL.revokeObjectURL(portrait.url);
      setPortrait({ blob, url: URL.createObjectURL(blob) });
      showToast(t('ai_done'));
    } catch (e) {
      showToast(errorText(e, t));
    } finally {
      setCropping(false);
    }
  };

  const goNext = async () => {
    if (step === 1) {
      if (pickMode && !picked) return setError(t('ph_entername'));
      if (!pickMode && !newName.trim()) return setError(t('ph_entername'));
      setStep(2);
      setError('');
      return;
    }
    if (step === 2) {
      if (!propertyId) return setError(t('err_hostel'));
      if (!roomId || selectedBedIds.length === 0) return setError(t('err_pick_bed'));
      setStep(3);
      setError('');
      return;
    }
    if (!manager.trim()) return setError(t('err_mgr'));
    if (!project.trim()) return setError(t('err_project'));
    await save();
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const tenantType = type === 'Commercial' ? 'commercial' : 'internal';
      let residentId: string;
      let residentName: string;
      if (createdResident.current) {
        ({ id: residentId, name: residentName } = createdResident.current);
      } else if (!pickMode) {
        residentName = newName.trim();
        const resident = await residentsRepository.create({ name: residentName, gender: newGender, phone: newPhone.trim(), dob: newDob, type: tenantType });
        residentId = resident.id;
        createdResident.current = { id: residentId, name: residentName };
        if (passportFiles.length) await residentsRepository.addDocuments(residentId, 'passport', passportFiles);
        if (otherFiles.length) await residentsRepository.addDocuments(residentId, 'other', otherFiles);
      } else {
        residentName = picked!.name;
        // A booking names a person who may not have a record yet; it knows their gender.
        if (picked!.id) residentId = picked!.id;
        else {
          residentId = (await residentsRepository.create({ name: residentName, gender: picked!.booking?.gender ?? null, type: tenantType })).id;
          createdResident.current = { id: residentId, name: residentName };
        }
        if (picked!.id && !residentsById.has(picked!.id)) {
          const hit = directory.rows.find((r) => r.id === picked!.id);
          if (hit) {
            const { type: _type, ...resident } = hit;
            void _type;
            useEntityStore.setState((s) => ({ residents: [...s.residents, resident] }));
          }
        }
      }

      const stay = await checkIn({
        residentId, residentName, propertyId, roomId, bedIds: selectedBedIds, type,
        manager: manager.trim(), project: project.trim(), checkIn: date,
        bookingId: picked?.booking?.id ?? fromBooking?.id, discount: (picked?.booking ?? fromBooking)?.discount,
      });
      // The photo is set once the stay exists, when the resident is visible to every role that may check in.
      if (!pickMode && portrait) await residentsRepository.setAvatar(residentId, portrait.blob).catch(() => {});
      showToast(t('toast_ci', { n: residentName, p: selectedRoom ? translatePlace(selectedRoom.name, lang) : '' }));
      onSaved([stay]);
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

  const personName = pickMode ? picked?.name ?? '—' : newName.trim() || '—';
  const reviewName = safeName(personName, !!roleConfig.hideNames, t('hidden_name'));
  const nightlyRate = rateForBeds(
    selectedBedIds.map((id) => bedsById.get(id)).filter((b): b is Bed => Boolean(b)), type, (picked?.booking ?? fromBooking)?.discount,
  );
  const reviewPlace = selectedRoom ? `${translatePlace(selectedRoom.name, lang)} · ${selectedBedIds.map((id) => bedsById.get(id)?.index).join(', ')}` : '—';

  const fileList = (files: File[], remove: (i: number) => void) =>
    files.length ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
        {files.map((f, i) => (
          <span key={`${f.name}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 7, padding: '4px 8px', fontSize: 12 }}>
            {f.name}
            <button type="button" onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-faint)', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
    ) : null;

  const filePicker = (label: string, onPick: (files: File[]) => void, accept: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--color-bg)', border: '1px dashed #D6D6DE', borderRadius: 9, padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)' }}>
      <span style={{ fontSize: 15 }}>⇲</span>
      <span>{label}</span>
      <input type="file" multiple accept={accept} onChange={(e) => { onPick(Array.from(e.target.files ?? [])); e.target.value = ''; }} style={{ display: 'none' }} />
    </label>
  );

  return (
    <Portal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 61, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: '100%', maxHeight: '92vh', background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 11, maxHeight: 300, overflowY: 'auto' }}>
                    {pool.map((r) => {
                      const on = picked ? (picked.id ? picked.id === r.id : picked.name === r.name) : false;
                      const displayName = safeName(r.name, !!roleConfig.hideNames, t('hidden_name'));
                      const avatarUrl = r.id ? residentsById.get(r.id)?.avatarUrl : undefined;
                      return (
                        <div key={r.id ?? `name:${r.name}`} className="rowh" onClick={() => { setPicked(r); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: '1px solid #F2F2F6', cursor: 'pointer', background: on ? '#FFFBE6' : '#fff' }}>
                          <Avatar name={displayName} size={34} url={avatarUrl} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{displayName}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--color-faint)' }}>{r.sub}</div>
                          </div>
                          <div style={{ color: 'var(--color-green)', fontWeight: 800, fontSize: 15, opacity: on ? 1 : 0 }}>✓</div>
                        </div>
                      );
                    })}
                    {directory.loading && <div style={{ padding: '10px 13px', fontSize: 12.5, color: 'var(--color-faint)' }}>{t('dl_loading')}…</div>}
                  </div>
                </>
              ) : (
                <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={FIELD_LABEL_STYLE}>{t('wz_fullname')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('ph_entername')} style={FIELD_STYLE} />
                  </div>
                  <div>
                    <div style={FIELD_LABEL_STYLE}>{t('wz_phone')}</div>
                    <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" placeholder="+420…" style={FIELD_STYLE} />
                  </div>
                  <div>
                    <div style={FIELD_LABEL_STYLE}>{t('wz_gender')}</div>
                    <select value={newGender} onChange={(e) => setNewGender(e.target.value as Gender)} style={FIELD_STYLE}>
                      <option value="M">{t('g_male')}</option>
                      <option value="F">{t('g_female')}</option>
                    </select>
                  </div>
                  <div>
                    <div style={FIELD_LABEL_STYLE}>{t('wz_dob')}</div>
                    <input value={newDob} onChange={(e) => setNewDob(e.target.value)} type="date" max={today()} style={FIELD_STYLE} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={FIELD_LABEL_STYLE}>{t('doc_passport')}</div>
                    {filePicker(t('doc_add'), (files) => setPassportFiles((prev) => [...prev, ...files]), 'image/*,application/pdf')}
                    {fileList(passportFiles, (i) => setPassportFiles((prev) => prev.filter((_, j) => j !== i)))}
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={newName || '?'} size={56} url={portrait?.url} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="chip" onClick={() => void cropPortrait()} disabled={cropping} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }}>
                        {cropping ? t('ai_busy') : t('ai_extract')}
                      </button>
                      {portrait && (
                        <button type="button" className="chip" onClick={() => { URL.revokeObjectURL(portrait.url); setPortrait(null); }} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', color: 'var(--color-muted)' }}>
                          {t('photo_remove')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={FIELD_LABEL_STYLE}>{t('doc_other')}</div>
                    {filePicker(t('doc_add'), (files) => setOtherFiles((prev) => [...prev, ...files]), 'image/*,application/pdf')}
                    {fileList(otherFiles, (i) => setOtherFiles((prev) => prev.filter((_, j) => j !== i)))}
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
              <div style={{ display: 'flex', gap: 11, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={FIELD_LABEL_STYLE}>{t('hostel')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setRoomId(''); setSelectedBedIds([]); setError(''); }} style={FIELD_STYLE}>
                    <option value="">{t('select')}</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {propertyId && (
                  <div className="num" style={{ fontSize: 12.5, color: 'var(--color-muted)', paddingBottom: 10 }}>
                    {freeInProperty} {t('free').toLowerCase()}
                    {selectedBedIds.length > 0 && <> · <b style={{ color: 'var(--color-ink)' }}>{t('ci_beds_sel', { n: selectedBedIds.length })}</b></>}
                  </div>
                )}
              </div>
              {propertyId && (
                <>
                  {GROUP_ORDER.map((groupType) => {
                    const groupRooms = propertyRooms.filter((r) => r.type === groupType);
                    if (!groupRooms.length) return null;
                    return (
                      <div key={groupType} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10, marginBottom: 10 }}>
                        {groupRooms.map((room) => {
                          const roomBeds = beds.filter((b) => b.roomId === room.id).sort((a, b) => a.index - b.index);
                          const g = roomGender(roomBeds, residentsById);
                          const [gFg, gBg] = ROOM_GENDER_PILL[g] ?? DEFAULT_PILL;
                          const active = room.id === roomId;
                          return (
                            <div key={room.id} style={{ background: active ? '#FFFBE6' : '#fff', border: `1px solid ${active ? '#FFE88A' : 'var(--color-border)'}`, borderRadius: 12, padding: '11px 12px', opacity: room.available ? 1 : 0.6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{translatePlace(room.name.replace(/^.*? - /, ''), lang)}</span>
                                <Pill label={t(ROOM_GENDER_LABEL_KEY[g])} fg={gFg} bg={gBg} />
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {roomBeds.map((bed) => {
                                  const sel = selectedBedIds.includes(bed.id);
                                  const [bg, border, fg] = sel ? ['#141414', '#141414', '#FFD600'] : BED_TILE_COLORS[bed.status];
                                  const occupant = bed.residentId ? residentsById.get(bed.residentId) : undefined;
                                  return (
                                    <div
                                      key={bed.id}
                                      className="bed"
                                      onClick={() => pickBed(room, bed.id, bed.status)}
                                      title={occupant ? safeName(occupant.name, !!roleConfig.hideNames, t('hidden_name')) : bed.status === 'unavailable' ? t('unavail_tip') : t('free_place')}
                                      style={{ position: 'relative', minWidth: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, cursor: bed.status === 'free' ? 'pointer' : 'not-allowed', background: bg, border: `1px solid ${border}`, color: fg }}
                                    >
                                      {bed.index}
                                      {occupant && (
                                        <span style={{ position: 'absolute', bottom: -4, right: -4, fontSize: 10, background: '#fff', borderRadius: '50%', lineHeight: 1, padding: 1 }}>{occupant.gender ? GENDER_EMOJI[occupant.gender] : '👤'}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="num" style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 9 }}>
                                {formatCurrency(room.priceFrom, currency)}–{formatCurrency(room.priceTo, currency)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 4 }}>{t('ci_pick_hint')}</div>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3, marginBottom: 16 }}>
                {(['Internal', 'Commercial'] as const).map((k) => (
                  <button key={k} className="pbtn" onClick={() => { if (k !== type) setProject(''); setType(k); setError(''); }} style={{ flex: 1, background: type === k ? '#141414' : 'transparent', color: type === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {t(TYPE_LABEL_KEY[k])}
                  </button>
                ))}
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
                  <div style={FIELD_LABEL_STYLE}>{t('ff_checkin')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
                  <DatePopover value={date} onChange={setDate} />
                </div>
              </div>
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 11, padding: 14, marginTop: 15 }}>
                <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                  {[
                    { k: t('rg_resident'), v: reviewName },
                    { k: t('ff_hostel'), v: propertiesById.get(propertyId)?.name ?? '—' },
                    { k: t('pm_roomplace'), v: reviewPlace },
                    { k: t('ff_type'), v: t(TYPE_LABEL_KEY[type]) },
                    { k: t('bl_rate'), v: nightlyRate ? formatCurrency(nightlyRate, currency) : t('rate_none') },
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
          <button className="pbtn" onClick={() => void goNext()} disabled={saving} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13.5, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? t('saving') : step < 3 ? t('wz_continue') : t('ci_confirm')}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
