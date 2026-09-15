'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { ROLES } from '@/domain/roles';
import { billFor } from '@/domain/logic';
import { translatePlace, safeName, STATUS_LABEL_KEY, STATUS_PILL, DEFAULT_PILL } from '@/domain/labels';
import { formatCurrency } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { PaymentModal } from './PaymentModal';
import { StayLedgerModal } from './StayLedgerModal';
import { TransferForm } from './TransferForm';
import type { Stay, Transfer, TransferStatus } from '@/domain/types';

type Section = 'billing' | 'handover';
type BillingFilter = 'All' | 'Debtors' | 'Settled';
type HandoverFilter = 'All' | TransferStatus;

export function FinanceScreen() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useSessionStore((s) => s.lang);
  const currency = useSessionStore((s) => s.currency);
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const stays = useEntityStore((s) => s.stays);
  const payments = useEntityStore((s) => s.payments);
  const transfers = useEntityStore((s) => s.transfers);

  const initialSection: Section = searchParams.get('tab') === 'handover' ? 'handover' : 'billing';
  const [section, setSection] = useState<Section>(initialSection);
  const [billingFilter, setBillingFilter] = useState<BillingFilter>((searchParams.get('filter') as BillingFilter) ?? 'All');
  const [hostelFilter, setHostelFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [handoverFilter, setHandoverFilter] = useState<HandoverFilter>('All');

  const stayParam = searchParams.get('stay');
  const [ledgerStayId, setLedgerStayId] = useState<string | null>(stayParam);
  const [paymentOpen, setPaymentOpen] = useState(searchParams.get('openPay') === '1');
  const [paymentStay, setPaymentStay] = useState<Stay | null>(stays.find((s) => s.id === stayParam) ?? null);
  const [transferFormOpen, setTransferFormOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);

  // ---- billing ----
  const debtorStays = activeStays.filter((s) => billFor(s, payments).debtor);
  const debtTotal = debtorStays.reduce((sum, s) => sum + billFor(s, payments).balance, 0);
  const collected = payments.reduce((sum, p) => sum + p.amount, 0);
  const chargedAll = activeStays.reduce((sum, s) => sum + billFor(s, payments).charged, 0);

  const billingRows = activeStays
    .filter((s) => {
      const bill = billFor(s, payments);
      if (billingFilter === 'Debtors' && !bill.debtor) return false;
      if (billingFilter === 'Settled' && bill.debtor) return false;
      if (hostelFilter !== 'All' && s.propertyId !== hostelFilter) return false;
      if (search) {
        const property = propertiesById.get(s.propertyId)?.name ?? '';
        if (!`${s.residentName} ${property}`.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => billFor(b, payments).balance - billFor(a, payments).balance);

  // ---- handovers ----
  const accepted = transfers.filter((tr) => tr.status === 'Accepted').reduce((sum, tr) => sum + tr.amount, 0);
  const pending = transfers.filter((tr) => tr.status !== 'Accepted').reduce((sum, tr) => sum + tr.amount, 0);
  const handoverRows = transfers.filter((tr) => handoverFilter === 'All' || tr.status === handoverFilter);

  const ledgerStay = ledgerStayId ? stays.find((s) => s.id === ledgerStayId) ?? null : null;

  return (
    <section className="screen">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div>
          <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('fn_title')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{section === 'billing' ? t('bl_sub') : t('fn_sub')}</p>
        </div>
        {section === 'handover' ? (
          <button className="pbtn" onClick={() => { setEditingTransfer(null); setTransferFormOpen(true); }} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> {t('fn_new')}
          </button>
        ) : (
          <button className="pbtn" onClick={() => { setPaymentStay(null); setPaymentOpen(true); }} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> {t('bl_new')}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 11, padding: 3, marginBottom: 20, width: 'fit-content' }}>
        {(['handover', 'billing'] as const).map((k) => (
          <button key={k} className="pbtn" onClick={() => setSection(k)} style={{ background: section === k ? '#141414' : 'transparent', color: section === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {k === 'handover' ? t('fn_sec_handover') : t('fn_sec_billing')}
          </button>
        ))}
      </div>

      {section === 'billing' ? (
        <>
          <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 13, marginBottom: 20 }}>
            <div className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '17px 19px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('bl_debt_total')}</div>
              <div className="fig" style={{ fontSize: 31, marginTop: 5, color: debtTotal > 0 ? 'var(--color-red)' : '#22A06B' }}>{formatCurrency(debtTotal, currency)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{t('dash_debt_title', { n: debtorStays.length })}</div>
            </div>
            <div className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '17px 19px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('bl_collected')}</div>
              <div className="fig" style={{ fontSize: 31, marginTop: 5, color: '#22A06B' }}>{formatCurrency(collected, currency)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{t('bl_of', { v: formatCurrency(chargedAll, currency) })}</div>
            </div>
            <div className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '17px 19px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('bl_debtors')}</div>
              <div className="fig" style={{ fontSize: 31, marginTop: 5 }}>{debtorStays.length}/{activeStays.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{t('kpi_networkwide')}</div>
            </div>
          </div>

          <div className="filterbar" style={{ display: 'flex', gap: 9, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3 }}>
              {(['All', 'Debtors', 'Settled'] as const).map((k) => (
                <button key={k} className="pbtn" onClick={() => setBillingFilter(k)} style={{ background: billingFilter === k ? '#141414' : 'transparent', color: billingFilter === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {k === 'All' ? t('f_all_bl') : k === 'Debtors' ? t('f_debtors') : t('f_settled')}
                </button>
              ))}
            </div>
            <select value={hostelFilter} onChange={(e) => setHostelFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
              <option value="All">{t('f_all_hostels')}</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_name')} style={{ flex: 1, minWidth: 170, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 13px', fontSize: 13.5, outline: 'none' }} />
            <span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-faint)' }}>{billingRows.length}/{activeStays.length}</span>
          </div>

          {billingRows.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center', color: 'var(--color-faint)', fontSize: 13 }}>{t('no_results')}</div>
          ) : (
            <div className="stagger tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.9fr) minmax(0,1.5fr) minmax(0,.7fr) minmax(82px,.9fr) minmax(82px,1fr) minmax(82px,1fr) minmax(82px,1.1fr) 84px', gap: 11, padding: '12px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 10.5, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  <div>{t('col_name')}</div><div>{t('col_hostel_place')}</div><div>{t('bl_nights')}</div><div>{t('bl_rate')}</div><div>{t('bl_charged')}</div><div>{t('bl_paid')}</div><div>{t('bl_balance')}</div><div></div>
                </div>
                {billingRows.map((s) => {
                  const bill = billFor(s, payments);
                  const name = safeName(s.residentName, !!roleConfig.hideNames, t('hidden_name'));
                  const room = roomsById.get(s.roomId);
                  const bed = bedsById.get(s.bedId);
                  const placeLabel = `${propertiesById.get(s.propertyId)?.name ?? ''} · ${room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : ''}`;
                  const [badgeFg, badgeBg] = bill.debtor ? ['#C0392B', '#FDECEC'] : ['#1B7F52', '#E4F6EC'];
                  return (
                    <div key={s.id} className="rowh" onClick={() => setLedgerStayId(s.id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.9fr) minmax(0,1.5fr) minmax(0,.7fr) minmax(82px,.9fr) minmax(82px,1fr) minmax(82px,1fr) minmax(82px,1.1fr) 84px', gap: 11, padding: '13px 20px', borderBottom: '1px solid #F2F2F6', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <Avatar name={name} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                          <Pill label={bill.debtor ? t('bl_owes') : t('bl_ok')} fg={badgeFg} bg={badgeBg} />
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{placeLabel}</div>
                        <div style={{ marginTop: 5, height: 4, borderRadius: 3, background: '#F1F1F5', overflow: 'hidden', maxWidth: 120 }}>
                          <div style={{ height: '100%', width: `${bill.covered}%`, background: bill.debtor ? '#F5A524' : '#22A06B' }} />
                        </div>
                      </div>
                      <div className="num" style={{ fontSize: 13 }}>{bill.days}</div>
                      <div className="num" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{formatCurrency(bill.rate, currency)}</div>
                      <div className="num" style={{ fontSize: 13 }}>{formatCurrency(bill.charged, currency)}</div>
                      <div className="num" style={{ fontSize: 13, color: '#1B7F52' }}>{formatCurrency(bill.paid, currency)}</div>
                      <div className="num" style={{ fontSize: 14, fontWeight: 700, color: bill.debtor ? 'var(--color-red)' : '#1B7F52' }}>{formatCurrency(bill.debtor ? bill.balance : Math.min(bill.balance, 0), currency)}</div>
                      <div style={{ textAlign: 'right' }}>
                        <button className="pbtn" onClick={(e) => { e.stopPropagation(); setPaymentStay(s); setPaymentOpen(true); }} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          + {t('bl_pay_short')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 13, marginBottom: 20 }}>
            <div className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '17px 19px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('mk_accepted')}</div>
              <div className="fig" style={{ fontSize: 31, marginTop: 5, color: '#22A06B' }}>{formatCurrency(accepted, currency)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{t('mk_period')}</div>
            </div>
            <div className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '17px 19px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('mk_pending')}</div>
              <div className="fig" style={{ fontSize: 31, marginTop: 5, color: '#B8860B' }}>{formatCurrency(pending, currency)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{t('mk_handed')}</div>
            </div>
            <div className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '17px 19px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('mk_transfers')}</div>
              <div className="fig" style={{ fontSize: 31, marginTop: 5 }}>{transfers.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{t('mk_period')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3 }}>
              {(['All', 'Handed over', 'Accepted'] as const).map((k) => (
                <button key={k} className="pbtn" onClick={() => setHandoverFilter(k)} style={{ background: handoverFilter === k ? '#141414' : 'transparent', color: handoverFilter === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {k === 'All' ? t('t_all') : t(STATUS_LABEL_KEY[k])}
                </button>
              ))}
            </div>
          </div>

          <div className="stagger tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,1.3fr) minmax(82px,1fr) minmax(112px,1.2fr) minmax(76px,.9fr)', gap: 11, padding: '12px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 10.5, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                <div>{t('col_hostel')}</div><div>{t('col_handedby')}</div><div>{t('col_to')}</div><div>{t('col_amount')}</div><div>{t('col_created')}</div><div>{t('col_status')}</div>
              </div>
              {handoverRows.map((tr) => {
                const [statusFg, statusBg] = STATUS_PILL[tr.status] ?? DEFAULT_PILL;
                return (
                  <div key={tr.id} className="rowh" onClick={() => { setEditingTransfer(tr); setTransferFormOpen(true); }} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,1.3fr) minmax(82px,1fr) minmax(112px,1.2fr) minmax(76px,.9fr)', gap: 11, padding: '13px 20px', borderBottom: '1px solid #F2F2F6', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{propertiesById.get(tr.propertyId)?.name}</div>
                    <div style={{ fontSize: 12.5 }}>{tr.by}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{tr.to}</div>
                    <div className="num" style={{ fontSize: 13.5, fontWeight: 600 }}>{formatCurrency(tr.amount, currency)}</div>
                    <div className="num" style={{ fontSize: 12, color: 'var(--color-faint)' }}>{tr.date}</div>
                    <div><Pill label={t(STATUS_LABEL_KEY[tr.status])} fg={statusFg} bg={statusBg} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {ledgerStay && (
        <StayLedgerModal
          stay={ledgerStay}
          onClose={() => setLedgerStayId(null)}
          onAddPayment={() => { setLedgerStayId(null); setPaymentStay(ledgerStay); setPaymentOpen(true); }}
        />
      )}
      {paymentOpen && (
        <PaymentModal
          key={paymentStay?.id ?? 'pick'}
          stay={paymentStay}
          onClose={() => { setPaymentOpen(false); router.replace('/finance?tab=billing'); }}
          onSaved={() => { setPaymentOpen(false); router.replace('/finance?tab=billing'); }}
        />
      )}
      {transferFormOpen && (
        <TransferForm
          key={editingTransfer?.id ?? 'new'}
          editing={editingTransfer}
          onClose={() => setTransferFormOpen(false)}
          onSaved={() => setTransferFormOpen(false)}
        />
      )}
    </section>
  );
}
