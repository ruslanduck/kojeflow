'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { ROLES } from '@/domain/roles';
import { propertyStat } from '@/domain/dashboard';
import { roomGender } from '@/domain/logic';
import type { Bed, Room, RoomType } from '@/domain/types';
import { translatePlace, safeName, TYPE_LABEL_KEY, ROOM_GENDER_LABEL_KEY, ROOM_GENDER_PILL, TYPE_PILL, DEFAULT_PILL, GENDER_EMOJI, BED_TILE_COLORS } from '@/domain/labels';
import { formatCurrency, formatDateDMY } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { RoomHistoryModal } from '@/components/dashboard/RoomHistoryModal';

const GROUP_ORDER: RoomType[] = ['Room', 'Apartment', 'Wagon'];
const GROUP_LABEL_KEY: Record<RoomType, string> = { Room: 'grp_Rooms', Apartment: 'grp_Apartments', Wagon: 'grp_Wagons' };

export function PropertyDetail({ propertyId, showBackToDash }: { propertyId: string; showBackToDash: boolean }) {
  const t = useT();
  const router = useRouter();
  const lang = useSessionStore((s) => s.lang);
  const currency = useSessionStore((s) => s.currency);
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const residents = useEntityStore((s) => s.residents);
  const stays = useEntityStore((s) => s.stays);

  const [tab, setTab] = useState<'rooms' | 'residents'>('rooms');
  const [logRoomId, setLogRoomId] = useState<string | null>(null);

  const property = properties.find((p) => p.id === propertyId);
  const propertyRooms = useMemo(() => rooms.filter((r) => r.propertyId === propertyId), [rooms, propertyId]);
  const residentsById = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);
  const staysByResidentId = useMemo(
    () => new Map(stays.filter((s) => s.status === 'active' && s.propertyId === propertyId).map((s) => [s.residentId, s])),
    [stays, propertyId],
  );

  if (!property) {
    return (
      <section className="screen">
        <p style={{ color: 'var(--color-muted)' }}>{t('not_assigned')}</p>
      </section>
    );
  }

  const stat = propertyStat(property, rooms, beds);
  const occRate = stat.total ? Math.round((stat.occupied / stat.total) * 100) : 0;
  const summary = `${stat.roomsCount} · ${stat.total} ${t('places_word')} · ${t('occ_label', { n: occRate, f: stat.free })}`;

  const bedTitle = (bed: Bed) => {
    if (bed.status === 'occupied' && bed.residentId) {
      const resident = residentsById.get(bed.residentId);
      return `${safeName(resident?.name ?? '', !!roleConfig.hideNames, t('hidden_name'))} · ${t('occ_place')}`;
    }
    if (bed.status === 'booked') return t('booked_tip');
    return t('free_tip');
  };

  const onBedClick = (bed: Bed, room: Room) => {
    if (bed.status === 'occupied' && bed.residentId) router.push(`/residents?person=${bed.residentId}`);
    else if (bed.status === 'booked') router.push(`/bookings?property=${propertyId}`);
    else if (bed.status === 'free') router.push(`/checkin?property=${propertyId}&room=${room.id}&bed=${bed.id}`);
  };

  const roomGroups = GROUP_ORDER.map((type) => {
    const typeRooms = propertyRooms.filter((r) => r.type === type);
    if (typeRooms.length === 0) return null;
    return { type, label: t(GROUP_LABEL_KEY[type]), rooms: typeRooms };
  }).filter((g): g is { type: RoomType; label: string; rooms: Room[] } => g !== null);

  const residentRows = propertyRooms
    .flatMap((room) => beds.filter((b) => b.roomId === room.id && b.status === 'occupied' && b.residentId).map((bed, i) => ({ bed, room, index: i })))
    .map(({ bed, room }) => {
      const resident = residentsById.get(bed.residentId as string);
      const stay = resident ? staysByResidentId.get(resident.id) : undefined;
      return { bed, room, resident, stay };
    })
    .filter((r) => r.resident && r.stay);

  return (
    <section className="screen">
      {showBackToDash && (
        <button
          className="chip"
          onClick={() => router.push('/dashboard')}
          style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer', color: 'var(--color-muted)', marginBottom: 14, fontWeight: 500 }}
        >
          {t('hc_back')}
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 className="hd ptitle" style={{ fontSize: 38 }}>{property.name}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{summary}</p>
        </div>
        <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 3 }}>
          {(['rooms', 'residents'] as const).map((k) => (
            <button
              key={k}
              className="pbtn"
              onClick={() => setTab(k)}
              style={{ background: tab === k ? '#141414' : 'transparent', color: tab === k ? '#fff' : 'var(--color-muted)', border: 'none', borderRadius: 8, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {k === 'rooms' ? t('tab_rooms') : t('nav_residents')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        {[{ color: '#22A06B', label: t('free_place') }, { color: '#B4B4C0', label: t('occ_place') }, { color: '#FFD600', label: t('booked_place') }].map((g) => (
          <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--color-muted)' }}>
            <span style={{ width: 11, height: 11, borderRadius: 4, display: 'inline-block', background: g.color }} />
            {g.label}
          </div>
        ))}
      </div>

      {tab === 'rooms' &&
        roomGroups.map((group) => (
          <div key={group.type} style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
              <h2 className="hd" style={{ fontSize: 19 }}>{group.label}</h2>
              <span className="num" style={{ fontSize: 11, color: 'var(--color-muted)', background: 'var(--color-yellow)', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>{group.rooms.length}</span>
            </div>
            <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(304px,1fr))', gap: 13 }}>
              {group.rooms.map((room) => {
                const roomBeds = beds.filter((b) => b.roomId === room.id).sort((a, b) => a.index - b.index);
                const g = roomGender(roomBeds, residentsById);
                const [fg, bg] = ROOM_GENDER_PILL[g] ?? DEFAULT_PILL;
                const occupied = roomBeds.filter((b) => b.status === 'occupied').length;
                const free = roomBeds.filter((b) => b.status === 'free').length;
                return (
                  <div key={room.id} className="lift" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '15px 17px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 }}>
                      <div className="hd" style={{ fontSize: 17, whiteSpace: 'nowrap' }}>{translatePlace(room.name, lang)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Pill label={t(ROOM_GENDER_LABEL_KEY[g])} fg={fg} bg={bg} />
                        <button
                          className="chip"
                          onClick={() => setLogRoomId(room.id)}
                          title={t('room_log')}
                          style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 7, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}
                        >
                          {t('log')}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 13 }}>
                      {roomBeds.map((bed) => {
                        const [bg, border, fg] = BED_TILE_COLORS[bed.status];
                        const resident = bed.residentId ? residentsById.get(bed.residentId) : undefined;
                        return (
                          <div
                            key={bed.id}
                            className="bed"
                            onClick={() => onBedClick(bed, room)}
                            title={bedTitle(bed)}
                            style={{ position: 'relative', minWidth: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: bg, border: `1px solid ${border}`, color: fg }}
                          >
                            {bed.index}
                            {bed.status === 'occupied' && resident && (
                              <span style={{ position: 'absolute', bottom: -4, right: -4, fontSize: 11, background: '#fff', borderRadius: '50%', lineHeight: 1, padding: 1 }}>
                                {GENDER_EMOJI[resident.gender]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F2F2F6', paddingTop: 10 }}>
                      <div className="num" style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>
                        {occupied}/{roomBeds.length} · {free} {t('free').toLowerCase()}
                      </div>
                      <div className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {formatCurrency(room.priceFrom, currency)}–{formatCurrency(room.priceTo, currency)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      {tab === 'residents' && (
        <div className="stagger tscroll" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1.5fr) minmax(0,.9fr) minmax(78px,1fr) minmax(0,1.4fr)', gap: 12, padding: '12px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 10.5, color: 'var(--color-muted)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            <div>{t('col_name')}</div><div>{t('col_room_place')}</div><div>{t('col_type')}</div><div>{t('col_checkin')}</div><div>{t('col_mgr_project')}</div>
          </div>
          {residentRows.map(({ bed, room, resident, stay }) => {
            const name = safeName(resident!.name, !!roleConfig.hideNames, t('hidden_name'));
            const [fg, bg] = TYPE_PILL[stay!.type] ?? DEFAULT_PILL;
            return (
              <div
                key={bed.id}
                className="rowh"
                onClick={() => router.push(`/residents?person=${resident!.id}`)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1.5fr) minmax(0,.9fr) minmax(78px,1fr) minmax(0,1.4fr)', gap: 12, padding: '13px 20px', borderBottom: '1px solid #F2F2F6', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={name} size={30} />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</span>
                </div>
                <div style={{ fontSize: 12.5 }}>{translatePlace(`${room.name} · Place ${bed.index}`, lang)}</div>
                <div><Pill label={t(TYPE_LABEL_KEY[stay!.type])} fg={fg} bg={bg} /></div>
                <div className="num" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{formatDateDMY(stay!.checkIn)}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{stay!.manager} · {stay!.project}</div>
              </div>
            );
          })}
        </div>
      )}

      {logRoomId && <RoomHistoryModal propertyId={propertyId} roomId={logRoomId} onClose={() => setLogRoomId(null)} />}
    </section>
  );
}
