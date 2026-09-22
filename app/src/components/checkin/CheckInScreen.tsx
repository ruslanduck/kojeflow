'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { ROLES } from '@/domain/roles';
import { billFor, TODAY } from '@/domain/logic';
import { checkOut } from '@/repositories/operations';
import { translatePlace, safeName, TYPE_LABEL_KEY, TYPE_PILL, DEFAULT_PILL } from '@/domain/labels';
import { formatCurrency, formatDateDMY } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { CheckInWizard } from './CheckInWizard';
import type { Booking } from '@/domain/types';
import { MappingNotice } from '@/components/ui/Unmapped';

export function CheckInScreen() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const currency = useSessionStore((s) => s.currency);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const stays = useEntityStore((s) => s.stays);
  const bookings = useEntityStore((s) => s.bookings);
  const payments = useEntityStore((s) => s.payments);

  const [propertyFilter, setPropertyFilter] = useState('All');
  const [search, setSearch] = useState('');
  const bookingParam = searchParams.get('booking');
  const [wizardOpen, setWizardOpen] = useState(!!bookingParam);
  const fromBooking: Booking | null = bookingParam ? (bookings.find((b) => b.id === bookingParam) ?? null) : null;

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);

  const visibleProperties = roleConfig.ownHostel ? properties.filter((p) => p.name === roleConfig.ownHostel) : properties;
  const activeStays = stays.filter((s) => s.status === 'active');
  const scopedStays = roleConfig.ownHostel ? activeStays.filter((s) => propertiesById.get(s.propertyId)?.name === roleConfig.ownHostel) : activeStays;

  const filteredStays = scopedStays.filter((s) => {
    if (propertyFilter !== 'All' && s.propertyId !== propertyFilter) return false;
    if (search && !s.residentName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalFreeBeds = (roleConfig.ownHostel ? beds.filter((b) => propertiesById.get(b.propertyId)?.name === roleConfig.ownHostel) : beds).filter((b) => b.status === 'free').length;
  const awaitingCount = bookings.filter((b) => b.status === 'New' && (!roleConfig.ownHostel || propertiesById.get(b.propertyId)?.name === roleConfig.ownHostel)).length;

  const kpis = [
    { label: t('ci_kpi_living'), value: String(scopedStays.length), color: '#1B7F52', sub: t('kpi_networkwide') },
    { label: t('ci_kpi_free'), value: String(totalFreeBeds), color: 'var(--color-red)', sub: t('kpi_free_sub') },
    { label: t('ci_kpi_await'), value: String(awaitingCount), color: '#B8860B', sub: t('kpi_awaiting') },
  ];

  const openWizard = () => setWizardOpen(true);

  return (
    <section className="screen">
      <MappingNotice
        items={[
          { entity: 'Bed', field: 'status' },
          { entity: 'Payment', field: 'amount' },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div>
          <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('ci_title')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{t('ci_sub')}</p>
        </div>
        <button className="pbtn" onClick={openWizard} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> {t('ci_new')}
        </button>
      </div>

      <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 13, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '17px 19px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
            <div className="fig" style={{ fontSize: 31, marginTop: 5, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="filterbar" style={{ display: 'flex', gap: 9, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
          <option value="All">{t('f_all_hostels')}</option>
          {visibleProperties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_name')} style={{ flex: 1, minWidth: 180, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 13px', fontSize: 13.5, outline: 'none' }} />
        <span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-faint)' }}>{filteredStays.length}/{scopedStays.length}</span>
      </div>

      <div className="stagger tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,.9fr) minmax(78px,1fr) minmax(82px,1.15fr) 168px', gap: 11, padding: '12px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 10.5, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            <div>{t('col_name')}</div><div>{t('col_hostel')}</div><div>{t('col_room_place')}</div><div>{t('col_type')}</div><div>{t('col_since')}</div><div>{t('bl_balance')}</div><div></div>
          </div>
          {filteredStays.map((s) => {
            const name = safeName(s.residentName, !!roleConfig.hideNames, t('hidden_name'));
            const room = roomsById.get(s.roomId);
            const bed = bedsById.get(s.bedId);
            const placeLabel = room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : '';
            const [typeFg, typeBg] = TYPE_PILL[s.type] ?? DEFAULT_PILL;
            const bill = billFor(s, payments);
            return (
              <div
                key={s.id}
                className="rowh"
                onClick={() => router.push(`/residents?person=${s.residentId}`)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,.9fr) minmax(78px,1fr) minmax(82px,1.15fr) 168px', gap: 11, padding: '13px 20px', borderBottom: '1px solid #F2F2F6', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={name} size={28} />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</span>
                </div>
                <div style={{ fontSize: 12.5 }}>{propertiesById.get(s.propertyId)?.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{placeLabel}</div>
                <div><Pill label={t(TYPE_LABEL_KEY[s.type])} fg={typeFg} bg={typeBg} /></div>
                <div className="num" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{formatDateDMY(s.checkIn)}</div>
                <div className="num" style={{ fontSize: 12.5, fontWeight: 700, color: bill.debtor ? 'var(--color-red)' : '#1B7F52' }}>
                  {bill.debtor ? '+' : ''}{formatCurrency(bill.balance, currency)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button
                    className="pbtn"
                    onClick={(e) => { e.stopPropagation(); router.push(`/finance?tab=billing&stay=${s.id}`); }}
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 11px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  >
                    + {t('bl_pay_short')}
                  </button>
                  <button
                    className="pbtn"
                    onClick={(e) => { e.stopPropagation(); if (window.confirm(t('checkout_confirm', { n: name }))) void checkOut(s.id, TODAY); }}
                    title={t('checkout_action')}
                    style={{ background: '#fff', border: '1px solid #F6CBCB', borderRadius: 8, padding: '6px 11px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-red)', whiteSpace: 'nowrap' }}
                  >
                    {t('checkout_action')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {wizardOpen && (
        <CheckInWizard
          key={fromBooking?.id ?? 'new'}
          fromBooking={fromBooking}
          defaultPropertyId={propertyFilter !== 'All' ? propertyFilter : undefined}
          onClose={() => { setWizardOpen(false); if (bookingParam) router.replace('/checkin'); }}
          onSaved={() => { setWizardOpen(false); if (bookingParam) router.replace('/checkin'); }}
        />
      )}
    </section>
  );
}
