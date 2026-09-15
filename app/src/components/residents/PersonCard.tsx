'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { residentsRepository } from '@/repositories/residentsRepository';
import { billFor } from '@/domain/logic';
import { translatePlace, safeName, TYPE_LABEL_KEY, STATUS_LABEL_KEY, TYPE_PILL, DEFAULT_PILL, ROOM_GENDER_LABEL_KEY } from '@/domain/labels';
import { formatCurrency, formatDateDMY } from '@/lib/format';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';
import { Portal } from '@/components/ui/Portal';
import { Lightbox } from '@/components/ui/Lightbox';
import type { Gender, ResidentDocument } from '@/domain/types';

interface PersonCardProps {
  residentId?: string;
  personName?: string;
  onClose: () => void;
}

export function PersonCard({ residentId, personName, onClose }: PersonCardProps) {
  const t = useT();
  const router = useRouter();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const currency = useSessionStore((s) => s.currency);
  const showToast = useSessionStore((s) => s.showToast);
  const roleConfig = ROLES[role];

  const residents = useEntityStore((s) => s.residents);
  const stays = useEntityStore((s) => s.stays);
  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const registrations = useEntityStore((s) => s.registrations);
  const bookings = useEntityStore((s) => s.bookings);
  const payments = useEntityStore((s) => s.payments);

  const [tab, setTab] = useState<'details' | 'log'>('details');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<Gender>('M');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | undefined>(undefined);
  const [editPassportDocs, setEditPassportDocs] = useState<ResidentDocument[]>([]);
  const [editOtherDocs, setEditOtherDocs] = useState<ResidentDocument[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [zoomDoc, setZoomDoc] = useState<{ url: string; title: string } | null>(null);

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);

  const resident = residentId ? residents.find((r) => r.id === residentId) : residents.find((r) => r.name === personName);
  const name = resident?.name ?? personName ?? '';
  const allStaysForResident = resident ? stays.filter((s) => s.residentId === resident.id).sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1)) : [];
  const activeStay = allStaysForResident.find((s) => s.status === 'active') ?? null;
  const booking = bookings.find((b) => b.residentName === name && b.status === 'New');
  const registration = registrations.find((r) => r.residentName === name);
  const bill = activeStay ? billFor(activeStay, payments) : null;

  if (!resident && !booking) {
    return (
      <Portal>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} onClick={onClose}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 400, background: '#fff', borderRadius: 18, padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
            {t('not_assigned')}
          </div>
        </div>
      </Portal>
    );
  }

  const displayName = safeName(name, !!roleConfig.hideNames, t('hidden_name'));
  const gender: 'M' | 'F' = resident?.gender ?? 'M';
  const propertyName = activeStay ? propertiesById.get(activeStay.propertyId)?.name : booking ? propertiesById.get(booking.propertyId)?.name : undefined;
  const room = activeStay ? roomsById.get(activeStay.roomId) : undefined;
  const bed = activeStay ? bedsById.get(activeStay.bedId) : undefined;
  const placeLabel = room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : t('not_assigned');
  const type = activeStay?.type ?? booking?.type ?? 'Internal';
  const manager = activeStay?.manager ?? booking?.manager;
  const project = activeStay?.project ?? booking?.project;
  const [typeFg, typeBg] = TYPE_PILL[type] ?? DEFAULT_PILL;

  const rows = [
    { k: t('pm_gender'), v: t(ROOM_GENDER_LABEL_KEY[gender]) },
    { k: t('pm_hostel'), v: propertyName ?? '—' },
    { k: t('pm_roomplace'), v: placeLabel },
    { k: t('pm_checkin'), v: activeStay ? formatDateDMY(activeStay.checkIn) : '—' },
    { k: t('pm_mgr'), v: manager ?? '—' },
    { k: t('pm_project'), v: project ?? '—' },
    { k: t('pm_registration'), v: registration ? `${t(STATUS_LABEL_KEY[registration.status])} · ${t(TYPE_LABEL_KEY[registration.type])}` : '—' },
    { k: t('col_expires'), v: registration ? formatDateDMY(registration.expires) : '—' },
  ];
  if (bill) rows.push({ k: t('bl_balance'), v: `${bill.debtor ? '+' : ''}${formatCurrency(bill.balance, currency)} · ${bill.days} × ${formatCurrency(bill.rate, currency)}` });

  const billBadge = bill ? (bill.debtor ? `${t('bl_owes')} ${formatCurrency(bill.balance, currency)}` : t('bl_ok')) : '';
  const [billFg, billBg] = bill ? (bill.debtor ? ['#C0392B', '#FDECEC'] : ['#1B7F52', '#E4F6EC']) : ['', ''];

  const startEdit = () => {
    setEditName(name);
    setEditGender(gender);
    setEditAvatarUrl(resident?.avatarUrl);
    setEditPassportDocs(resident?.passportDocs ?? []);
    setEditOtherDocs(resident?.otherDocs ?? []);
    setEditing(true);
  };
  const saveEdit = async () => {
    if (resident) {
      await residentsRepository.update(resident.id, {
        name: editName.trim() || name,
        gender: editGender,
        avatarUrl: editAvatarUrl,
        passportDocs: editPassportDocs,
        otherDocs: editOtherDocs,
      });
    }
    setEditing(false);
  };
  const addDocs = (kind: 'passport' | 'other', files: FileList | null) => {
    if (!files || !files.length) return;
    const docs: ResidentDocument[] = Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    if (kind === 'passport') setEditPassportDocs((prev) => [...prev, ...docs]);
    else setEditOtherDocs((prev) => [...prev, ...docs]);
    showToast(t('doc_n', { n: docs.length }));
  };
  const removeDoc = (kind: 'passport' | 'other', idx: number) => {
    if (kind === 'passport') setEditPassportDocs((prev) => prev.filter((_, i) => i !== idx));
    else setEditOtherDocs((prev) => prev.filter((_, i) => i !== idx));
  };
  const clearAvatar = () => setEditAvatarUrl(undefined);
  const extractAvatar = () => {
    if (!editPassportDocs.length) {
      showToast(t('ai_needscan'));
      return;
    }
    setAiBusy(true);
    const img = new window.Image();
    img.onload = () => {
      const sw = img.width * 0.3;
      const sh = sw * 1.28;
      const sx = img.width * 0.045;
      const sy = img.height * 0.22;
      const c = document.createElement('canvas');
      c.width = 420;
      c.height = Math.round(420 * 1.28);
      const g = c.getContext('2d');
      if (!g) {
        setAiBusy(false);
        return;
      }
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, sx, sy, sw, Math.min(sh, img.height - sy), 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (!blob) {
          setAiBusy(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        setTimeout(() => {
          setEditAvatarUrl(url);
          setAiBusy(false);
          showToast(t('ai_done'));
        }, 900);
      }, 'image/jpeg', 0.9);
    };
    img.onerror = () => setAiBusy(false);
    img.src = editPassportDocs[0].url;
  };

  return (
    <>
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', maxHeight: '92vh', background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={displayName} size={58} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hd" style={{ fontSize: 24 }}>{displayName}</div>
              <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Pill label={t(TYPE_LABEL_KEY[type])} fg={typeFg} bg={typeBg} />
                {bill && <Pill label={billBadge} fg={billFg} bg={billBg} />}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--color-faint-2)', cursor: 'pointer', lineHeight: 1, alignSelf: 'flex-start' }}>×</button>
          </div>

          {editing ? (
            <div style={{ padding: '18px 24px', flex: 1 }}>
              <div style={FIELD_LABEL_STYLE}>{t('wz_fullname')}</div>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...FIELD_STYLE, marginBottom: 12 }} />
              <div style={FIELD_LABEL_STYLE}>{t('wz_gender')}</div>
              <select value={editGender} onChange={(e) => setEditGender(e.target.value as Gender)} style={{ ...FIELD_STYLE, marginBottom: 18 }}>
                <option value="M">{t('g_male')}</option>
                <option value="F">{t('g_female')}</option>
              </select>

              <div style={{ paddingTop: 16, borderTop: '1px solid #ECECF1', display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
                <div
                  onClick={() => editAvatarUrl && setZoomDoc({ url: editAvatarUrl, title: editName })}
                  style={{
                    width: 56, height: 56, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    background: '#F1F1F5',
                    backgroundImage: editAvatarUrl ? `url("${editAvatarUrl}")` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    fontSize: 24, color: 'var(--color-muted)', fontWeight: 700,
                    boxShadow: editAvatarUrl ? '0 0 0 2px #fff, 0 0 0 3px #ECECF1' : 'inset 0 0 0 1px rgba(20,20,20,.08)',
                    cursor: editAvatarUrl ? 'zoom-in' : undefined,
                  }}
                >
                  {!editAvatarUrl && editName.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 170 }}>
                  <button
                    type="button"
                    onClick={extractAvatar}
                    disabled={aiBusy}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: aiBusy ? '#F6F6F8' : '#141414', color: aiBusy ? '#9A9AA6' : '#fff', border: 'none', borderRadius: 9, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: aiBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                  >
                    <span>✦</span>
                    <span>{aiBusy ? t('ai_busy') : t('ai_extract')}</span>
                  </button>
                  <div style={{ fontSize: 10.5, color: '#9A9AA6', marginTop: 5 }}>{t('ai_hint')}</div>
                </div>
                {editAvatarUrl && (
                  <button type="button" onClick={clearAvatar} style={{ background: '#fff', border: '1px solid #ECECF1', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', color: '#5C5C66', fontFamily: 'inherit' }}>
                    {t('av_remove')}
                  </button>
                )}
              </div>

              {([
                { kind: 'passport' as const, label: t('doc_passport'), docs: editPassportDocs },
                { kind: 'other' as const, label: t('doc_other'), docs: editOtherDocs },
              ]).map(({ kind, label, docs }) => (
                <div key={kind} style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
                    <div style={{ fontSize: 12, color: '#5C5C66', fontWeight: 600 }}>{label}</div>
                    <label style={{ background: '#F6F6F8', border: '1px solid #ECECF1', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#141414' }}>
                      {t('doc_add')}
                      <input type="file" accept="image/*" multiple onChange={(e) => { addDocs(kind, e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {docs.length === 0 ? (
                    <div style={{ border: '1px dashed #E0E0E8', borderRadius: 10, padding: 16, textAlign: 'center', fontSize: 12, color: '#9A9AA6' }}>{t('doc_none')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {docs.map((d, i) => (
                        <div key={`${d.url}-${i}`} style={{ position: 'relative' }}>
                          <div
                            onClick={() => setZoomDoc({ url: d.url, title: d.name })}
                            title={d.name}
                            style={{ width: 62, height: 62, borderRadius: 9, cursor: 'zoom-in', backgroundColor: '#F1F1F5', backgroundImage: `url("${d.url}")`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 1px rgba(20,20,20,.1)' }}
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeDoc(kind, i); }}
                            title={t('doc_remove')}
                            style={{ position: 'absolute', top: -6, right: -6, background: '#fff', border: '1px solid #F6CBCB', color: '#C0392B', borderRadius: '50%', width: 19, height: 19, fontSize: 11, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 6px rgba(20,20,20,.18)' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 3, padding: '12px 24px 0' }}>
                {(['details', 'log'] as const).map((k) => (
                  <button key={k} className="pbtn" onClick={() => setTab(k)} style={{ background: tab === k ? '#141414' : 'transparent', color: tab === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {k === 'details' ? t('tab_details') : t('tab_history')}
                  </button>
                ))}
              </div>
              <div style={{ padding: '10px 24px 18px', overflowY: 'auto', flex: 1 }}>
                {tab === 'details' &&
                  rows.map((row) => (
                    <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '1px solid #F2F2F6' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--color-faint)' }}>{row.k}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 500, textAlign: 'right' }}>{row.v}</span>
                    </div>
                  ))}
                {tab === 'log' && (
                  allStaysForResident.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 34, color: 'var(--color-faint)', fontSize: 13 }}>{t('no_log')}</div>
                  ) : (
                    allStaysForResident.map((s) => {
                      const sRoom = roomsById.get(s.roomId);
                      const sBed = bedsById.get(s.bedId);
                      const sPlace = sRoom && sBed ? translatePlace(`${sRoom.name} · Place ${sBed.index}`, lang) : '';
                      const period = s.status === 'active' ? t('period_now', { d: formatDateDMY(s.checkIn) }) : `${formatDateDMY(s.checkIn)} — ${formatDateDMY(s.checkOut)}`;
                      return (
                        <div key={s.id} style={{ display: 'flex', gap: 13, padding: '12px 0', borderBottom: '1px solid #F2F2F6' }}>
                          <div style={{ width: 9, height: 9, borderRadius: '50%', background: s.status === 'active' ? '#22A06B' : '#B4B4C0', marginTop: 5, flex: 'none' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{propertiesById.get(s.propertyId)?.name}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{sPlace}</div>
                          </div>
                          <div className="num" style={{ fontSize: 12.5, color: 'var(--color-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{period}</div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </>
          )}

          <div style={{ padding: '15px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9, flexWrap: 'wrap' }}>
            {editing ? (
              <>
                <button className="chip" onClick={() => setEditing(false)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{t('cancel')}</button>
                <button className="pbtn" onClick={() => void saveEdit()} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t('save')}</button>
              </>
            ) : (
              <>
                <button className="chip" onClick={onClose} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{t('close')}</button>
                {bill && activeStay && (
                  <>
                    <button className="chip" onClick={() => router.push(`/finance?tab=billing&stay=${activeStay.id}&scope=person`)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {t('bl_ledger')}
                    </button>
                    <button className="pbtn" onClick={() => router.push(`/finance?tab=billing&stay=${activeStay.id}&openPay=1`)} style={{ background: 'var(--color-magenta)', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      + {t('bl_pay_short')}
                    </button>
                  </>
                )}
                {resident && (
                  <button className="pbtn" onClick={startEdit} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('edit_details')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
    {zoomDoc && <Lightbox url={zoomDoc.url} title={zoomDoc.title} onClose={() => setZoomDoc(null)} />}
    </>
  );
}
