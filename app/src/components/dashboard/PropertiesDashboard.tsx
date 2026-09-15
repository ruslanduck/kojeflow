'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { ROLES } from '@/domain/roles';
import { propertyStat, applyDayShift, dayShift } from '@/domain/dashboard';
import { occupancyColor, billFor, TODAY } from '@/domain/logic';
import { GENDER_EMOJI } from '@/domain/labels';
import { formatCurrency, formatDateDMY } from '@/lib/format';
import { DatePopover } from '@/components/ui/DatePopover';
import { Pill } from '@/components/ui/Pill';

export function PropertiesDashboard() {
  const t = useT();
  const router = useRouter();
  const role = useSessionStore((s) => s.role);
  const currency = useSessionStore((s) => s.currency);
  const canSeeBalance = ROLES[role].balance;

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const stays = useEntityStore((s) => s.stays);
  const payments = useEntityStore((s) => s.payments);

  const [dashDate, setDashDate] = useState(TODAY);
  const shift = dayShift(dashDate);
  const asOf = shift > 0 ? formatDateDMY(dashDate) : t('d_today');

  const rows = useMemo(
    () =>
      properties.map((p) => {
        const stat = applyDayShift(propertyStat(p, rooms, beds), shift);
        const rate = stat.total ? Math.round((stat.adjustedOccupied / stat.total) * 100) : 0;
        const dotColor = occupancyColor(stat.total ? stat.adjustedOccupied / stat.total : 0);
        const badges: { label: string; pill: boolean }[] = [];
        (['M', 'F', 'X'] as const).forEach((g) => {
          const n = g === 'M' ? p.bookedMale : g === 'F' ? p.bookedFemale : p.bookedMixed;
          if (n) badges.push({ label: `${GENDER_EMOJI[g]} ${n}`, pill: true });
        });
        if (badges.length === 0) badges.push({ label: '—', pill: false });
        return { property: p, stat, rate, dotColor, badges };
      }),
    [properties, rooms, beds, shift],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => {
          a.occ += r.stat.occupied;
          a.adjOcc += r.stat.adjustedOccupied;
          a.total += r.stat.total;
          a.booked += r.stat.booked;
          a.free += r.stat.free;
          a.bal += r.property.balance;
          a.proc += r.property.inProcess;
          return a;
        },
        { occ: 0, adjOcc: 0, total: 0, booked: 0, free: 0, bal: 0, proc: 0 },
      ),
    [rows],
  );
  const adjustedFreeTotal = totals.free + (totals.occ - totals.adjOcc);

  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);
  const debtors = useMemo(
    () => (canSeeBalance ? activeStays.filter((s) => billFor(s, payments).debtor) : []),
    [activeStays, payments, canSeeBalance],
  );
  const debtTotal = useMemo(() => debtors.reduce((sum, s) => sum + billFor(s, payments).balance, 0), [debtors, payments]);

  const kpis = [
    { label: t('kpi_occupied'), value: `${totals.adjOcc}/${totals.total}`, big: true, color: 'var(--color-ink)', sub: asOf },
    { label: t('kpi_free'), value: String(adjustedFreeTotal), big: true, color: 'var(--color-green)', sub: t('kpi_free_sub') },
    canSeeBalance
      ? { label: t('kpi_balance'), value: formatCurrency(totals.bal, currency), big: false, color: totals.bal < 0 ? 'var(--color-red)' : 'var(--color-ink)', sub: totals.proc ? t('proc_label', { v: formatCurrency(totals.proc, currency) }) : '' }
      : { label: t('kpi_balance'), value: '—', big: true, color: 'var(--color-faint-2)', sub: t('kpi_restricted') },
    { label: t('kpi_booked'), value: String(totals.booked), big: true, color: '#B8860B', sub: t('kpi_networkwide') },
  ];

  return (
    <section className="screen">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('dash_title')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{t('dash_sub')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <button
            type="button"
            onClick={() => router.push('/floorplan')}
            title={t('fp_open')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 11, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-magenta)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3 3 5.4v15.1L9 18l6 2.6 6-2.4V3l-6 2.4z" />
              <path d="M9 3v15" />
              <path d="M15 5.4v15.2" />
            </svg>
            <span>{t('fp_open')}</span>
          </button>
          <DatePopover value={dashDate} onChange={setDashDate} variant="dashboard" align="right" />
        </div>
      </div>

      {canSeeBalance && debtors.length > 0 && (
        <div style={{ background: '#FFF5F5', border: '1px solid #F6CBCB', borderRadius: 12, padding: '13px 17px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ fontSize: 17 }}>💸</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('dash_debt_title', { n: debtors.length })}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{t('dash_debt_sub', { v: formatCurrency(debtTotal, currency) })}</div>
          </div>
          <button
            className="chip"
            onClick={() => router.push('/finance?tab=billing&filter=Debtors')}
            style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 13px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
          >
            {t('bl_view')}
          </button>
        </div>
      )}

      <div className="g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 13, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '17px 19px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
            <div className="fig" style={{ fontSize: k.big ? 31 : 26, marginTop: 5, whiteSpace: 'nowrap', color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11.5, color: 'var(--color-faint)', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="stagger tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.9fr) minmax(96px,1fr) minmax(0,.8fr) minmax(0,1.5fr) minmax(0,1.5fr) minmax(82px,1fr) minmax(82px,1fr)', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: 10.5, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            <div>{t('col_hostel')}</div><div>{t('col_registrations')}</div><div>{t('col_rooms')}</div><div>{t('col_places')}</div><div>{t('col_balance')}</div><div>{t('col_booked')}</div><div>{t('col_price')}</div>
          </div>
          {rows.map(({ property, stat, rate, dotColor, badges }) => (
            <div
              key={property.id}
              className="rowh"
              onClick={() => router.push(`/properties/${property.id}`)}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.9fr) minmax(96px,1fr) minmax(0,.8fr) minmax(0,1.5fr) minmax(0,1.5fr) minmax(82px,1fr) minmax(82px,1fr)', gap: 10, padding: '14px 20px', borderBottom: '1px solid #F2F2F6', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 8, height: 22, borderRadius: 3, background: dotColor }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{property.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-faint)' }}>{t('occ_label', { n: rate, f: stat.adjustedFree })}</div>
                </div>
              </div>
              <div className="num" style={{ fontSize: 13.5, color: property.registrations > property.registrationsCapacity ? 'var(--color-red)' : 'var(--color-muted)' }}>
                {property.registrations} {t('of_max', { n: property.registrationsCapacity })}
              </div>
              <div className="num" style={{ fontSize: 13.5 }}>{stat.roomsCount}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#EDEDF2', overflow: 'hidden', maxWidth: 64 }}>
                  <div style={{ height: '100%', width: `${rate}%`, background: dotColor }} />
                </div>
                <span className="num" style={{ fontSize: 12.5 }}>
                  <b>{stat.adjustedOccupied}</b><span style={{ color: 'var(--color-faint-2)' }}>/{stat.total}</span>
                </span>
              </div>
              <div>
                <div className="num" style={{ fontSize: 13.5, fontWeight: 600, color: canSeeBalance && property.balance < 0 ? 'var(--color-red)' : 'var(--color-ink)' }}>
                  {canSeeBalance ? formatCurrency(property.balance, currency) : '—'}
                </div>
                {canSeeBalance && property.inProcess !== 0 && (
                  <div className="num" style={{ fontSize: 10.5, color: 'var(--color-faint)' }}>{t('proc_label', { v: formatCurrency(property.inProcess, currency) })}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {badges.map((b, i) =>
                  b.pill ? <Pill key={i} label={b.label} fg="#6B5300" bg="#FFF3B8" /> : <span key={i} className="num" style={{ fontSize: 12, color: 'var(--color-faint-2)' }}>{b.label}</span>,
                )}
              </div>
              <div className="num" style={{ fontSize: 12.5 }}>{formatCurrency(property.price, currency)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
