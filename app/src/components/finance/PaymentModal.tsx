'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { paymentsRepository } from '@/repositories/paymentsRepository';
import { billFor, TODAY } from '@/domain/logic';
import { translatePlace, safeName } from '@/domain/labels';
import { formatCurrency } from '@/lib/format';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { DatePopover } from '@/components/ui/DatePopover';
import { Portal } from '@/components/ui/Portal';
import type { Payment, Stay } from '@/domain/types';

interface PaymentModalProps {
  onClose: () => void;
  stay: Stay | null;
  onSaved: (payment: Payment) => void;
}

export function PaymentModal({ onClose, stay: initialStay, onSaved }: PaymentModalProps) {
  const t = useT();
  const currency = useSessionStore((s) => s.currency);
  const profileName = useSessionStore((s) => s.profileName);
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];

  const stays = useEntityStore((s) => s.stays);
  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const payments = useEntityStore((s) => s.payments);

  const [pickMode, setPickMode] = useState(!initialStay);
  const [pickSearch, setPickSearch] = useState('');
  const [stay, setStay] = useState<Stay | null>(initialStay);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState('');
  const [doc, setDoc] = useState<{ name: string; url: string } | null>(null);
  const [error, setError] = useState('');

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);

  const placeLabel = (s: Stay) => {
    const room = roomsById.get(s.roomId);
    const bed = bedsById.get(s.bedId);
    return room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, 'EN') : '';
  };

  const pickOptions = useMemo(
    () =>
      activeStays
        .filter((s) => !pickSearch || `${s.residentName} ${propertiesById.get(s.propertyId)?.name ?? ''}`.toLowerCase().includes(pickSearch.toLowerCase()))
        .map((s) => ({ stay: s, bill: billFor(s, payments) }))
        .sort((a, b) => b.bill.balance - a.bill.balance)
        .slice(0, 40),
    [activeStays, pickSearch, propertiesById, payments],
  );

  const bill = stay ? billFor(stay, payments) : { days: 0, rate: 0, charged: 0, paid: 0, balance: 0, debtor: false, covered: 0 };
  const displayName = stay ? safeName(stay.residentName, !!roleConfig.hideNames, t('hidden_name')) : '—';

  const pickDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setDoc({ name: f.name, url: URL.createObjectURL(f) });
    setError('');
  };

  const save = async () => {
    if (!stay) return setError(t('pay_err_who'));
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError(t('pay_err_amount'));
    if (!doc) return setError(t('pay_err_doc'));
    const payment = await paymentsRepository.create({
      stayId: stay.id, propertyId: stay.propertyId, amount: amt, by: profileName, at: date, docName: doc.name, note,
    });
    onSaved(payment);
  };

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 66 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 430, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 15px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {!pickMode && <Avatar name={displayName} size={44} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hd" style={{ fontSize: 19 }}>{t('pay_title')}</div>
              {!pickMode && stay ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayName} · {propertiesById.get(stay.propertyId)?.name} · {placeLabel(stay)}
                  </span>
                  <button type="button" onClick={() => setPickMode(true)} style={{ flex: 'none', background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--color-magenta)', cursor: 'pointer', textDecoration: 'underline' }}>
                    {t('pay_change')}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{t('pay_pick_sub')}</div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'var(--color-bg)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 18, lineHeight: 1, color: 'var(--color-muted)', cursor: 'pointer' }}>×</button>
          </div>

          {pickMode ? (
            <>
              <div style={{ padding: '14px 22px 0' }}>
                <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} placeholder={t('search_name')} style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', marginTop: 12, borderTop: '1px solid var(--color-border)' }}>
                {pickOptions.length === 0 && <div style={{ padding: '34px 22px', textAlign: 'center', fontSize: 13, color: 'var(--color-faint)' }}>{t('no_results')}</div>}
                {pickOptions.map(({ stay: s, bill: b }) => {
                  const rowName = safeName(s.residentName, !!roleConfig.hideNames, t('hidden_name'));
                  return (
                    <div key={s.id} onClick={() => { setStay(s); setAmount(b.balance > 0 ? String(b.balance) : ''); setPickMode(false); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: '1px solid #F2F2F6', cursor: 'pointer', background: '#fff' }}>
                      <Avatar name={rowName} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rowName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{propertiesById.get(s.propertyId)?.name} · {placeLabel(s)}</div>
                      </div>
                      <div className="num" style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: b.debtor ? 'var(--color-red)' : '#1B7F52' }}>{b.debtor ? '+' : ''}{formatCurrency(b.balance, currency)}</div>
                      <span style={{ color: '#C9C9D4', fontSize: 15 }}>›</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '17px 22px' }}>
              <div style={{ background: 'var(--color-bg)', borderRadius: 11, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
                  {[{ k: t('bl_nights'), v: String(bill.days) }, { k: t('bl_rate'), v: formatCurrency(bill.rate, currency) }, { k: t('bl_charged'), v: formatCurrency(bill.charged, currency) }, { k: t('bl_paid'), v: formatCurrency(bill.paid, currency) }].map((pl) => (
                    <div key={pl.k}>
                      <div style={{ fontSize: 10, color: 'var(--color-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{pl.k}</div>
                      <div className="num" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{pl.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 11, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>{t('bl_balance')}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 800, color: bill.balance > 0 ? 'var(--color-red)' : '#1B7F52' }}>{formatCurrency(bill.balance, currency)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 13 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('pay_amount')}</div>
                  <input type="number" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} placeholder="0" style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('pay_when')}</div>
                  <DatePopover value={date} onChange={setDate} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('pay_by')}</div>
                  <input value={profileName} disabled style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none', opacity: 0.6, cursor: 'not-allowed' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('pay_note')}</div>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pay_note_ph')} style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
                </div>
              </div>
              <div style={{ marginTop: 15 }}>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('pay_doc')}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px ' + (doc ? 'solid #B7E4CB' : 'dashed var(--color-scrollbar)'), background: doc ? '#F3FBF6' : 'var(--color-bg)', borderRadius: 10, padding: '12px 13px', cursor: 'pointer', fontSize: 13, color: doc ? '#1B7F52' : 'var(--color-muted)' }}>
                  <span style={{ fontSize: 15 }}>⇲</span>
                  {doc ? <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{doc.name}</span> : <span style={{ flex: 1 }}>{t('pay_doc_pick')}</span>}
                  {doc && <span style={{ fontSize: 14 }}>✓</span>}
                  <input type="file" accept="image/*,.pdf" onChange={pickDoc} style={{ display: 'none' }} />
                </label>
                <div style={{ fontSize: 10.5, color: 'var(--color-faint)', marginTop: 5 }}>{t('pay_doc_hint')}</div>
              </div>
              {error && <div style={{ background: '#FDECEC', border: '1px solid #F6CBCB', color: '#C0392B', borderRadius: 9, padding: '11px 14px', fontSize: 12.5, marginTop: 14, fontWeight: 500 }}>{error}</div>}
            </div>
          )}
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', color: 'var(--color-muted)' }}>{t('cancel')}</button>
            {!pickMode && (
              <button onClick={() => void save()} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{t('save')}</button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
