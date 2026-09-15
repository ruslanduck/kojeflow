'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { billFor } from '@/domain/logic';
import { translatePlace, safeName } from '@/domain/labels';
import { formatCurrency, formatDateDMY } from '@/lib/format';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { Portal } from '@/components/ui/Portal';
import { Lightbox } from '@/components/ui/Lightbox';
import type { Stay } from '@/domain/types';

type LedgerScope = 'stay' | 'person' | 'bed';

interface StayLedgerModalProps {
  stay: Stay;
  onClose: () => void;
  onAddPayment: () => void;
}

export function StayLedgerModal({ stay, onClose, onAddPayment }: StayLedgerModalProps) {
  const t = useT();
  const lang = useSessionStore((s) => s.lang);
  const currency = useSessionStore((s) => s.currency);
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const payments = useEntityStore((s) => s.payments);

  const [scope, setScope] = useState<LedgerScope>('stay');
  const [zoomDoc, setZoomDoc] = useState<{ url: string; title: string } | null>(null);

  const stays = useEntityStore((s) => s.stays);
  const staysById = useMemo(() => new Map(stays.map((s) => [s.id, s])), [stays]);

  const property = properties.find((p) => p.id === stay.propertyId);
  const room = rooms.find((r) => r.id === stay.roomId);
  const bed = beds.find((b) => b.id === stay.bedId);
  const placeLabel = room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : '';
  const displayName = safeName(stay.residentName, !!roleConfig.hideNames, t('hidden_name'));
  const bill = billFor(stay, payments);

  const scopeMatch = useMemo(() => {
    if (scope === 'person') return (p: (typeof payments)[number]) => staysById.get(p.stayId)?.residentName === stay.residentName;
    if (scope === 'bed') return (p: (typeof payments)[number]) => staysById.get(p.stayId)?.bedId === stay.bedId;
    return (p: (typeof payments)[number]) => p.stayId === stay.id;
  }, [scope, stay, staysById]);

  const scopedPayments = payments.filter(scopeMatch).sort((a, b) => (a.at < b.at ? 1 : -1));
  const scopeTotal = scopedPayments.reduce((sum, p) => sum + p.amount, 0);
  const scopeSubKey = scope === 'person' ? 'sc_person_sub' : scope === 'bed' ? 'sc_bed_sub' : 'sc_stay_sub';
  const showWho = scope !== 'stay';

  return (
    <>
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 65 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 15px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={displayName} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hd" style={{ fontSize: 19, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{property?.name} · {placeLabel}</div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--color-bg)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 18, lineHeight: 1, color: 'var(--color-muted)', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            {[{ k: t('bl_nights'), v: `${bill.days} × ${formatCurrency(bill.rate, currency)}` }, { k: t('bl_charged'), v: formatCurrency(bill.charged, currency) }, { k: t('bl_paid'), v: formatCurrency(bill.paid, currency) }].map((s) => (
              <div key={s.k}>
                <div style={{ fontSize: 10, color: 'var(--color-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.k}</div>
                <div className="num" style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--color-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t('bl_balance')}</div>
              <div className="num" style={{ fontSize: 19, fontWeight: 800, color: bill.debtor ? 'var(--color-red)' : '#1B7F52' }}>{formatCurrency(bill.balance, currency)}</div>
            </div>
          </div>
          <div style={{ padding: '13px 22px 0', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3 }}>
              {(['stay', 'person', 'bed'] as const).map((k) => (
                <button key={k} className="pbtn" onClick={() => setScope(k)} style={{ background: scope === k ? '#141414' : 'transparent', color: scope === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {k === 'stay' ? t('sc_stay') : k === 'person' ? t('sc_person') : t('sc_bed')}
                </button>
              ))}
            </div>
            <div className="num" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#1B7F52' }}>{formatCurrency(scopeTotal, currency)}</div>
          </div>
          <div style={{ padding: '7px 22px 0', fontSize: 11, color: 'var(--color-faint)' }}>{t(scopeSubKey)}</div>
          <div style={{ flex: 1, overflowY: 'auto', marginTop: 10 }}>
            {scopedPayments.length === 0 && <div style={{ padding: '26px 22px 34px', textAlign: 'center', fontSize: 13, color: 'var(--color-faint)' }}>{t('bl_no_pay')}</div>}
            {scopedPayments.map((p) => {
              const who = showWho ? safeName(staysById.get(p.stayId)?.residentName ?? '', !!roleConfig.hideNames, t('hidden_name')) : '';
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.9fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.3fr)', gap: 11, padding: '11px 22px', borderTop: '1px solid #F2F2F6', alignItems: 'center' }}>
                  <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: '#1B7F52' }}>{formatCurrency(p.amount, currency)}</div>
                  <div style={{ minWidth: 0 }}>
                    {showWho ? (
                      <>
                        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.by}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 12.5 }}>{p.by}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-faint)' }}>{t('col_recorded')}</div>
                      </>
                    )}
                  </div>
                  <div className="num" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{formatDateDMY(p.at)}</div>
                  <div
                    onClick={() => p.docUrl && setZoomDoc({ url: p.docUrl, title: p.docName })}
                    style={{
                      fontSize: 11.5, color: p.docUrl ? 'var(--color-ink)' : 'var(--color-faint)', textDecoration: p.docUrl ? 'underline' : 'none',
                      cursor: p.docUrl ? 'zoom-in' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {p.docName}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', color: 'var(--color-muted)' }}>{t('close')}</button>
            <button onClick={onAddPayment} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>+ {t('bl_addpay')}</button>
          </div>
        </div>
      </div>
    </Portal>
    {zoomDoc && <Lightbox url={zoomDoc.url} title={zoomDoc.title} onClose={() => setZoomDoc(null)} />}
    </>
  );
}
