'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { ROLES } from '@/domain/roles';
import { diffDays, TODAY } from '@/domain/logic';
import { translatePlace, safeName, TYPE_LABEL_KEY, STATUS_LABEL_KEY, STATUS_PILL, DEFAULT_PILL } from '@/domain/labels';
import { formatDateDMY } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { RegistrationForm } from './RegistrationForm';
import type { Registration } from '@/domain/types';
import { MappingNotice, Flagged } from '@/components/ui/Unmapped';

type ExpiryBucket = 'Expired' | 'Soon' | 'Valid';

function expiryBucket(expires: string): ExpiryBucket {
  const days = diffDays(TODAY, expires);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Soon';
  return 'Valid';
}

export function RegistrationsScreen() {
  const t = useT();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const stays = useEntityStore((s) => s.stays);
  const registrations = useEntityStore((s) => s.registrations);

  const [hostelFilter, setHostelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [expiryFilter, setExpiryFilter] = useState('All');
  const [visaFilter, setVisaFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Registration | null>(null);

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const activeStayByResidentName = useMemo(() => {
    const m = new Map<string, (typeof stays)[number]>();
    stays.filter((s) => s.status === 'active').forEach((s) => m.set(s.residentName, s));
    return m;
  }, [stays]);

  const coordinators = useMemo(() => Array.from(new Set(registrations.map((r) => r.coordinator))).sort(), [registrations]);
  const needAttention = registrations.filter((r) => expiryBucket(r.expires) !== 'Valid');

  const filtered = registrations.filter((r) => {
    if (hostelFilter !== 'All' && r.propertyId !== hostelFilter) return false;
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (typeFilter !== 'All' && r.type !== typeFilter) return false;
    if (visaFilter !== 'All' && r.coordinator !== visaFilter) return false;
    if (expiryFilter !== 'All') {
      const bucket = expiryBucket(r.expires);
      if (expiryFilter === 'Soon' ? bucket === 'Valid' : bucket !== expiryFilter) return false;
    }
    if (search && !r.residentName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (r: Registration) => { setEditing(r); setFormOpen(true); };

  return (
    <section className="screen">
      <MappingNotice
        items={[
          { entity: 'Registration', field: 'status' },
          { entity: 'Registration', field: 'coordinator' },
          { entity: 'Registration', field: 'docs' },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div>
          <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('rg_title')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{t('rg_sub', { n: registrations.length })}</p>
        </div>
        <button className="pbtn" onClick={openNew} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> {t('rg_new')}
        </button>
      </div>

      {needAttention.length > 0 && (
        <div style={{ background: '#FFFCEB', border: '1px solid #FFE88A', borderRadius: 12, padding: '13px 17px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ fontSize: 17 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t('expiring_title', { n: needAttention.length })}</div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{t('expiring_sub')}</div>
          </div>
          <button className="chip" onClick={() => setExpiryFilter('Soon')} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 13px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {t('review')}
          </button>
        </div>
      )}

      <div className="filterbar" style={{ display: 'flex', gap: 9, marginBottom: 9, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={hostelFilter} onChange={(e) => setHostelFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
          <option value="All">{t('f_all_hostels')}</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
          <option value="All">{t('f_all_status')}</option>
          <option value="New">{t('st_New')}</option>
          <option value="Registered">{t('st_Registered')}</option>
          <option value="Expired">{t('st_Expired')}</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
          <option value="All">{t('f_all_types')}</option>
          <option value="Free">{t('type_Free')}</option>
          <option value="Paid">{t('type_Paid')}</option>
        </select>
        <select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
          <option value="All">{t('f_all_expiry')}</option>
          <option value="Soon">{t('f_exp_soon')}</option>
          <option value="Expired">{t('f_exp_past')}</option>
          <option value="Valid">{t('f_exp_valid')}</option>
        </select>
        <select value={visaFilter} onChange={(e) => setVisaFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
          <option value="All">{t('f_all_visa')}</option>
          {coordinators.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_name')} style={{ flex: 1, minWidth: 170, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 13px', fontSize: 13.5, outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <button className="chip" onClick={() => { setHostelFilter('All'); setStatusFilter('All'); setTypeFilter('All'); setExpiryFilter('All'); setVisaFilter('All'); setSearch(''); }} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', color: 'var(--color-muted)' }}>
          {t('clear')}
        </button>
        <span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-faint)' }}>{filtered.length}/{registrations.length}</span>
      </div>

      <div className="stagger tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,.8fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(78px,1fr) minmax(78px,1fr) minmax(0,.6fr) minmax(76px,1fr)', gap: 10, padding: '12px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 10.5, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            <div>{t('col_name')}</div><div>{t('col_type')}</div><div>{t('col_hostel')}</div><div>{t('col_place')}</div><div>{t('col_issued')}</div><div>{t('col_expires')}</div><div>{t('col_docs')}</div><div>{t('col_status')}</div>
          </div>
          {filtered.map((r) => {
            const name = safeName(r.residentName, !!roleConfig.hideNames, t('hidden_name'));
            const [statusFg, statusBg] = STATUS_PILL[r.status] ?? DEFAULT_PILL;
            const bucket = expiryBucket(r.expires);
            const expiryColor = bucket === 'Expired' ? 'var(--color-red)' : bucket === 'Soon' ? '#B8860B' : 'var(--color-muted)';
            const stay = activeStayByResidentName.get(r.residentName);
            const room = stay ? roomsById.get(stay.roomId) : undefined;
            const bed = stay ? bedsById.get(stay.bedId) : undefined;
            const place = room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : t('not_assigned');
            return (
              <div
                key={r.id}
                className="rowh"
                onClick={() => openEdit(r)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,.8fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(78px,1fr) minmax(78px,1fr) minmax(0,.6fr) minmax(76px,1fr)', gap: 10, padding: '13px 20px', borderBottom: '1px solid #F2F2F6', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={name} size={28} />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{t(TYPE_LABEL_KEY[r.type])}</div>
                <div style={{ fontSize: 12.5 }}>{propertiesById.get(r.propertyId)?.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{place}</div>
                <div className="num" style={{ fontSize: 12, color: 'var(--color-muted)' }}>{formatDateDMY(r.issued)}</div>
                <div className="num" style={{ fontSize: 12, fontWeight: 600, color: expiryColor }}>{formatDateDMY(r.expires)}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  <Flagged entity="Registration" field="docs">📎 {r.docs}</Flagged>
                </div>
                <div>
                  <Flagged entity="Registration" field="status">
                    <Pill label={t(STATUS_LABEL_KEY[r.status])} fg={statusFg} bg={statusBg} />
                  </Flagged>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {formOpen && (
        <RegistrationForm
          key={editing?.id ?? 'new'}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => setFormOpen(false)}
        />
      )}
    </section>
  );
}
