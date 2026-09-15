'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { ROLES } from '@/domain/roles';
import { translatePlace, safeName, TYPE_LABEL_KEY, TYPE_PILL, DEFAULT_PILL } from '@/domain/labels';
import { formatDateDMY } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { PersonCard } from './PersonCard';

export function ResidentsScreen() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const stays = useEntityStore((s) => s.stays);

  const [hostelFilter, setHostelFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [search, setSearch] = useState('');

  const propertiesById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const bedsById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);
  const activeStays = useMemo(() => stays.filter((s) => s.status === 'active'), [stays]);

  const managerNames = useMemo(() => Array.from(new Set(activeStays.map((s) => s.manager))).sort(), [activeStays]);
  const projectNames = useMemo(() => Array.from(new Set(activeStays.map((s) => s.project))).sort(), [activeStays]);

  const filtered = activeStays.filter((s) => {
    if (hostelFilter !== 'All' && s.propertyId !== hostelFilter) return false;
    if (typeFilter !== 'All' && s.type !== typeFilter) return false;
    if (managerFilter !== 'All' && s.manager !== managerFilter) return false;
    if (projectFilter !== 'All' && s.project !== projectFilter) return false;
    if (search) {
      const property = propertiesById.get(s.propertyId)?.name ?? '';
      const haystack = `${s.residentName} ${property}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const personId = searchParams.get('person');
  const personName = searchParams.get('personName');
  const closeCard = () => router.push('/residents');

  return (
    <section className="screen">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div>
          <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('rs_title')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{t('rs_sub')}</p>
        </div>
      </div>

      <div className="filterbar" style={{ display: 'flex', gap: 9, marginBottom: 9, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={hostelFilter} onChange={(e) => setHostelFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
          <option value="All">{t('f_all_hostels')}</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none' }}>
          <option value="All">{t('f_all_types')}</option>
          <option value="Internal">{t('type_Internal')}</option>
          <option value="Commercial">{t('type_Commercial')}</option>
        </select>
        <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none', maxWidth: 190 }}>
          <option value="All">{t('f_all_mgrs')}</option>
          {managerNames.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 32px 10px 13px', fontSize: 13.5, outline: 'none', maxWidth: 210 }}>
          <option value="All">{t('f_all_projects')}</option>
          {projectNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_tenant')} style={{ flex: 1, minWidth: 170, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 13px', fontSize: 13.5, outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <button className="chip" onClick={() => { setHostelFilter('All'); setTypeFilter('All'); setManagerFilter('All'); setProjectFilter('All'); setSearch(''); }} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', color: 'var(--color-muted)' }}>
          {t('clear')}
        </button>
        <span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-faint)' }}>{filtered.length}/{activeStays.length}</span>
      </div>

      <div className="stagger tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,.8fr) minmax(0,1.7fr) minmax(78px,1fr) minmax(0,1.2fr) minmax(0,1.3fr)', gap: 11, padding: '12px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 10.5, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            <div>{t('col_name')}</div><div>{t('col_type')}</div><div>{t('col_hostel_place')}</div><div>{t('col_checkin')}</div><div>{t('col_mgr_resp')}</div><div>{t('col_project')}</div>
          </div>
          {filtered.map((s) => {
            const name = safeName(s.residentName, !!roleConfig.hideNames, t('hidden_name'));
            const room = roomsById.get(s.roomId);
            const bed = bedsById.get(s.bedId);
            const placeLabel = `${propertiesById.get(s.propertyId)?.name ?? ''} · ${room && bed ? translatePlace(`${room.name} · Place ${bed.index}`, lang) : ''}`;
            const [typeFg, typeBg] = TYPE_PILL[s.type] ?? DEFAULT_PILL;
            return (
              <div
                key={s.id}
                className="rowh"
                onClick={() => router.push(`/residents?person=${s.residentId}`)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,.8fr) minmax(0,1.7fr) minmax(78px,1fr) minmax(0,1.2fr) minmax(0,1.3fr)', gap: 11, padding: '13px 20px', borderBottom: '1px solid #F2F2F6', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Avatar name={name} size={32} />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</span>
                </div>
                <div><Pill label={t(TYPE_LABEL_KEY[s.type])} fg={typeFg} bg={typeBg} /></div>
                <div style={{ fontSize: 12.5 }}>{placeLabel}</div>
                <div className="num" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{formatDateDMY(s.checkIn)}</div>
                <div style={{ fontSize: 12 }}>{s.manager}</div>
                <div style={{ fontSize: 12, color: 'var(--color-faint)' }}>{s.project}</div>
              </div>
            );
          })}
        </div>
      </div>

      {(personId || personName) && <PersonCard residentId={personId ?? undefined} personName={personName ?? undefined} onClose={closeCard} />}
    </section>
  );
}
