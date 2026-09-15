'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { roomGender } from '@/domain/logic';
import { translatePlace, safeName, ROOM_GENDER_LABEL_KEY, ROOM_GENDER_PILL, DEFAULT_PILL, BED_TILE_COLORS } from '@/domain/labels';
import { formatCurrency } from '@/lib/format';
import { ROLES } from '@/domain/roles';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { Portal } from '@/components/ui/Portal';
import { RoomHistoryModal } from '@/components/dashboard/RoomHistoryModal';

export function RoomZonePanel({ propertyId, roomId, onClose }: { propertyId: string; roomId: string; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const lang = useSessionStore((s) => s.lang);
  const currency = useSessionStore((s) => s.currency);
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];
  const [logOpen, setLogOpen] = useState(false);

  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const residents = useEntityStore((s) => s.residents);

  const room = rooms.find((r) => r.id === roomId);
  const residentsById = new Map(residents.map((r) => [r.id, r]));
  const roomBeds = beds.filter((b) => b.roomId === roomId).sort((a, b) => a.index - b.index);

  if (!room) return null;

  const g = roomGender(roomBeds, residentsById);
  const [genderFg, genderBg] = ROOM_GENDER_PILL[g] ?? DEFAULT_PILL;
  const occupied = roomBeds.filter((b) => b.status === 'occupied').length;
  const available = roomBeds.filter((b) => b.status !== 'unavailable').length;

  return (
    <>
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 64 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '17px 20px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hd" style={{ fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{translatePlace(room.name, lang)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                <Pill label={t(ROOM_GENDER_LABEL_KEY[g])} fg={genderFg} bg={genderBg} />
                <span style={{ fontSize: 11.5, color: 'var(--color-muted)', fontWeight: 600 }}>{formatCurrency(room.priceFrom, currency)}–{formatCurrency(room.priceTo, currency)}</span>
              </div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, borderRadius: 20, padding: '3px 10px', color: '#fff', background: '#141414' }}>{occupied}/{available}</span>
            <button onClick={onClose} style={{ background: 'var(--color-bg)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 18, lineHeight: 1, color: 'var(--color-muted)', cursor: 'pointer', flex: 'none' }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {roomBeds.map((bed) => {
              const resident = bed.residentId ? residentsById.get(bed.residentId) : undefined;
              const [bg, border, fg] = BED_TILE_COLORS[bed.status];
              const who = resident ? safeName(resident.name, !!roleConfig.hideNames, t('hidden_name')) : bed.status === 'unavailable' ? t('fp_legend_off') : bed.status === 'booked' ? t('booked_place') : t('fp_legend_free');
              return (
                <div
                  key={bed.id}
                  onClick={() => { if (resident) { onClose(); router.push(`/residents?person=${resident.id}`); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #F2F2F6', cursor: resident ? 'pointer' : 'default' }}
                >
                  <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: bg, border: `1px solid ${border}`, color: fg }}>{bed.index}</span>
                  {resident && <Avatar name={who} size={30} />}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: resident ? 600 : 500, color: resident ? 'var(--color-ink)' : fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '13px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button
              className="chip"
              onClick={() => setLogOpen(true)}
              style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-muted)' }}
            >
              {t('room_log')}
            </button>
            <button
              className="pbtn"
              onClick={onClose}
              style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
    {logOpen && <RoomHistoryModal propertyId={propertyId} roomId={roomId} onClose={() => setLogOpen(false)} />}
    </>
  );
}
