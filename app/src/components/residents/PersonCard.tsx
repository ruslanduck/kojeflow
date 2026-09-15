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
import type { Gender } from '@/domain/types';

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
    setEditing(true);
  };
  const saveEdit = async () => {
    if (resident) await residentsRepository.update(resident.id, { name: editName.trim() || name, gender: editGender });
    setEditing(false);
  };

  return (
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
              <select value={editGender} onChange={(e) => setEditGender(e.target.value as Gender)} style={FIELD_STYLE}>
                <option value="M">{t('g_male')}</option>
                <option value="F">{t('g_female')}</option>
              </select>
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
  );
}
