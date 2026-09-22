'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { bookingsRepository } from '@/repositories/bookingsRepository';
import { ROLES } from '@/domain/roles';
import { MANAGERS } from '@/domain/people';
import { translatePlace, safeName, TYPE_LABEL_KEY, STATUS_LABEL_KEY, TYPE_PILL, STATUS_PILL, DEFAULT_PILL } from '@/domain/labels';
import { formatDateDMY } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BookingWizard } from './BookingWizard';
import type { Booking, BookingStatus } from '@/domain/types';
import { MappingNotice, LocalOnly } from '@/components/ui/Unmapped';
import { useDataSourceStore } from '@/store/dataSource';

const TABS: (BookingStatus | 'All')[] = ['All', 'New', 'Checked-in', 'Cancelled'];

export function BookingsScreen() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const profileName = useSessionStore((s) => s.profileName);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const stays = useEntityStore((s) => s.stays);
  const bookings = useEntityStore((s) => s.bookings);
  const localIds = useDataSourceStore((s) => s.localIds);

  const [tab, setTab] = useState<BookingStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState(searchParams.get('property') ?? 'All');
  const [typeFilter, setTypeFilter] = useState<'All' | Booking['type']>('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const activeStayByResidentName = useMemo(() => {
    const m = new Map<string, (typeof stays)[number]>();
    stays.filter((s) => s.status === 'active').forEach((s) => m.set(s.residentName, s));
    return m;
  }, [stays]);

  const visibleProperties = roleConfig.ownHostel ? properties.filter((p) => p.name === roleConfig.ownHostel) : properties;

  const filtered = bookings.filter((b) => {
    if (roleConfig.ownHostel && propertiesById.get(b.propertyId)?.name !== roleConfig.ownHostel) return false;
    if (roleConfig.ownOnly && b.by !== profileName) return false;
    if (tab !== 'All' && b.status !== tab) return false;
    if (propertyFilter !== 'All' && b.propertyId !== propertyFilter) return false;
    if (typeFilter !== 'All' && b.type !== typeFilter) return false;
    if (managerFilter !== 'All' && b.manager !== managerFilter) return false;
    if (search) {
      const haystack = `${b.residentName} ${propertiesById.get(b.propertyId)?.name ?? ''} ${b.comment}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const noFilters = tab === 'All' && propertyFilter === 'All' && typeFilter === 'All' && managerFilter === 'All' && !search;
  const emptyMessage = roleConfig.ownOnly && noFilters ? t('bk_empty_own') : t('no_bookings');

  const openNew = () => { setEditing(null); setWizardOpen(true); };
  const openEdit = (b: Booking) => { setEditing(b); setWizardOpen(true); };
  const cancelBooking = async (b: Booking) => {
    await bookingsRepository.update(b.id, { status: 'Cancelled' });
    setConfirmCancel(null);
  };

  return (
    <section className="screen">
      <MappingNotice
        items={[
          { entity: 'Booking', field: 'project' },
          { entity: 'Booking', field: 'payer' },
          { entity: 'Booking', field: 'discount' },
          { entity: 'Booking', field: 'comment' },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div>
          <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('bk_title')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{t('bk_sub', { n: bookings.filter((b) => b.status === 'New').length })}</p>
        </div>
        <button className="pbtn" onClick={openNew} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> {t('bk_new')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 11, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3 }}>
          {TABS.map((k) => (
            <button key={k} className="pbtn" onClick={() => setTab(k)} style={{ background: tab === k ? '#141414' : 'transparent', color: tab === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {k === 'All' ? t('t_all') : t(STATUS_LABEL_KEY[k])}
            </button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_booking')} style={{ flex: 1, minWidth: 200, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, outline: 'none' }} />
      </div>

      <div className="filterbar" style={{ display: 'flex', gap: 9, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 30px 9px 12px', fontSize: 13, outline: 'none' }}>
          <option value="All">{t('f_all_hostels')}</option>
          {visibleProperties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'All' | Booking['type'])} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 30px 9px 12px', fontSize: 13, outline: 'none' }}>
          <option value="All">{t('f_all_types')}</option>
          <option value="Internal">{t('type_Internal')}</option>
          <option value="Commercial">{t('type_Commercial')}</option>
        </select>
        <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 30px 9px 12px', fontSize: 13, outline: 'none', maxWidth: 200 }}>
          <option value="All">{t('f_all_mgrs')}</option>
          {MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button className="chip" onClick={() => { setTab('All'); setPropertyFilter('All'); setTypeFilter('All'); setManagerFilter('All'); setSearch(''); }} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', color: 'var(--color-muted)' }}>
          {t('clear')}
        </button>
        <span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-faint)' }}>{t('showing', { n: filtered.length })}</span>
      </div>

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((b) => {
          const property = propertiesById.get(b.propertyId);
          const stay = activeStayByResidentName.get(b.residentName);
          const room = stay ? roomsById.get(stay.roomId) : undefined;
          const bed = stay ? bedsById.get(stay.bedId) : undefined;
          const assignLabel = room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : t('not_assigned');
          const done = b.status === 'Checked-in';
          const cancelled = b.status === 'Cancelled';
          const isOpen = expanded === b.id;
          const name = safeName(b.residentName, !!roleConfig.hideNames, t('hidden_name'));
          const [typeFg, typeBg] = TYPE_PILL[b.type] ?? DEFAULT_PILL;
          const [statusFg, statusBg] = STATUS_PILL[b.status] ?? DEFAULT_PILL;

          return (
            <div key={b.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 13, overflow: 'hidden' }}>
              <div
                className="rowh bkrow"
                onClick={() => setExpanded(isOpen ? null : b.id)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.1fr) minmax(0,1.3fr) minmax(0,1.5fr) minmax(78px,1.2fr) minmax(92px,.9fr) 26px', gap: 13, padding: '15px 19px', alignItems: 'center', cursor: 'pointer' }}
              >
                <div className="bkwho" style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <Avatar name={name} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Pill label={t(TYPE_LABEL_KEY[b.type])} fg={typeFg} bg={typeBg} />
                      {localIds.has(b.id) && <LocalOnly />}
                    </div>
                  </div>
                </div>
                <div className="bkcell"><div style={{ fontSize: 13, fontWeight: 500 }}>{property?.name}</div><div style={{ fontSize: 11.5, color: 'var(--color-faint)' }}>{assignLabel}</div></div>
                <div className="bkcell"><div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{b.manager}</div><div style={{ fontSize: 11.5, color: 'var(--color-faint)' }}>{b.project}</div></div>
                <div className="bkcell"><div className="num" style={{ fontSize: 13 }}>{formatDateDMY(b.date)}</div><div style={{ fontSize: 11.5, color: 'var(--color-faint)' }}>{t('by_prefix')} {b.by}</div></div>
                <div className="bkstatus"><Pill label={t(STATUS_LABEL_KEY[b.status])} fg={statusFg} bg={statusBg} /></div>
                <div className="bkchev" style={{ textAlign: 'center', color: 'var(--color-faint-2)', fontSize: 12, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</div>
              </div>
              {isOpen && (
                <div style={{ padding: '0 19px 17px', borderTop: '1px solid #F2F2F6', background: '#FAFAFC' }}>
                  <div className="g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16, padding: '15px 0' }}>
                    {[
                      { k: t('exp_payer'), v: b.payer || '—' },
                      { k: t('exp_family'), v: b.family ? t('yes') : t('no') },
                      { k: t('exp_discount'), v: b.discount || '—' },
                      { k: t('exp_comment'), v: b.comment || '—' },
                    ].map((row) => (
                      <div key={row.k}>
                        <div style={{ fontSize: 10, color: 'var(--color-faint)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{row.k}</div>
                        <div style={{ fontSize: 13, marginTop: 3 }}>{row.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <button className="chip" onClick={(e) => { e.stopPropagation(); router.push(`/residents?personName=${encodeURIComponent(b.residentName)}`); }} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 15px', fontSize: 13, cursor: 'pointer', color: 'var(--color-ink)', fontWeight: 600 }}>
                      {t('view_person')}
                    </button>
                    <button
                      className="pbtn"
                      onClick={(e) => { e.stopPropagation(); if (!done && !cancelled) router.push(`/checkin?booking=${b.id}`); }}
                      style={{ background: done || cancelled ? '#EDEDF2' : '#141414', color: done || cancelled ? 'var(--color-faint)' : '#fff', border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 600, cursor: done || cancelled ? 'default' : 'pointer' }}
                    >
                      {done ? t('btn_checkedin') : cancelled ? t('btn_cancelled') : t('btn_checkin')}
                    </button>
                    <button className="chip" onClick={(e) => { e.stopPropagation(); openEdit(b); }} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 15px', fontSize: 13, cursor: 'pointer' }}>
                      {t('edit')}
                    </button>
                    {!done && !cancelled && (
                      <button className="chip" onClick={(e) => { e.stopPropagation(); setConfirmCancel(b); }} style={{ background: '#fff', border: '1px solid #F6CBCB', borderRadius: 9, padding: '9px 15px', fontSize: 13, cursor: 'pointer', color: 'var(--color-red)', fontWeight: 600 }}>
                        {t('cancel_booking')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 46, color: 'var(--color-faint)', background: '#fff', border: '1px dashed var(--color-border)', borderRadius: 13 }}>{emptyMessage}</div>
        )}
      </div>

      {confirmCancel && (
        <ConfirmDialog
          title={t('cancel_booking_title')}
          sub={t('cancel_booking_confirm', { n: safeName(confirmCancel.residentName, !!roleConfig.hideNames, t('hidden_name')) })}
          confirmLabel={t('cancel_booking')}
          cancelLabel={t('keep_booking')}
          onCancel={() => setConfirmCancel(null)}
          onConfirm={() => void cancelBooking(confirmCancel)}
        />
      )}

      {wizardOpen && (
        <BookingWizard
          key={editing?.id ?? 'new'}
          onClose={() => setWizardOpen(false)}
          editing={editing}
          defaultPropertyId={propertyFilter !== 'All' ? propertyFilter : undefined}
          onSaved={() => setWizardOpen(false)}
        />
      )}
    </section>
  );
}
