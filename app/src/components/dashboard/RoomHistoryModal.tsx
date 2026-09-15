'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { ROLES } from '@/domain/roles';
import { roomHistoryRows } from '@/domain/logic';
import { translatePlace, safeName } from '@/domain/labels';
import { formatDateDMY } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { Portal } from '@/components/ui/Portal';

export function RoomHistoryModal({ propertyId, roomId, onClose }: { propertyId: string; roomId: string; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const residents = useEntityStore((s) => s.residents);
  const stays = useEntityStore((s) => s.stays);

  const property = properties.find((p) => p.id === propertyId);
  const room = rooms.find((r) => r.id === roomId);
  const residentsById = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);
  const roomBeds = useMemo(() => beds.filter((b) => b.roomId === roomId).sort((a, b) => a.index - b.index), [beds, roomId]);

  if (!property || !room) return null;

  const rows = roomHistoryRows(property.name, room, roomBeds, residentsById, stays);

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 540, maxWidth: '100%', maxHeight: '92vh', background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="hd" style={{ fontSize: 22 }}>{property.name} · {translatePlace(room.name, lang)}</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-faint)', marginTop: 2 }}>{t('room_log_sub')}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--color-faint-2)', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: '8px 24px 18px', overflowY: 'auto', flex: 1 }}>
            {rows.map((row, i) => {
              const name = safeName(row.name, !!roleConfig.hideNames, t('hidden_name'));
              const period = row.periodEnd === null ? t('period_now', { d: formatDateDMY(row.periodStart) }) : `${formatDateDMY(row.periodStart)} — ${formatDateDMY(row.periodEnd)}`;
              const [badgeFg, badgeBg] = row.isReal ? ['#C0392B', '#FDECEC'] : ['#5C5C66', '#EDEDF2'];
              return (
                <div key={`${row.name}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F2F2F6' }}>
                  <Avatar name={name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-faint)' }}>{translatePlace(row.place, lang)}</div>
                  </div>
                  <div className="num" style={{ fontSize: 12.5, color: 'var(--color-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{period}</div>
                  <Pill label={row.isReal ? t('occ_place') : t('st_CheckedIn')} fg={badgeFg} bg={badgeBg} />
                  {row.isReal && row.stayId && (
                    <button
                      className="pbtn"
                      onClick={() => router.push(`/finance?tab=billing&stay=${row.stayId}&openPay=1`)}
                      title={t('bed_billing')}
                      style={{ background: '#F6F6F8', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', color: '#141414' }}
                    >
                      {t('bl_pay_short')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
}
