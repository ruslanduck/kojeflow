'use client';

import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { useEntityStore } from '@/store/entities';
import { useSessionStore } from '@/store/session';
import { translatePlace } from '@/domain/labels';
import { Portal } from '@/components/ui/Portal';
import type { Room } from '@/domain/types';

interface MapZoneDialogProps {
  unmappedRooms: Room[];
  onCancel: () => void;
  onConfirm: (roomId: string) => void;
}

export function MapZoneDialog({ unmappedRooms, onCancel, onConfirm }: MapZoneDialogProps) {
  const t = useT();
  const lang = useSessionStore((s) => s.lang);
  const beds = useEntityStore((s) => s.beds);
  const [selected, setSelected] = useState('');

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 120 }} onClick={onCancel}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="hd" style={{ fontSize: 19 }}>{t('fp_maproom')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>{t('fp_maproom_sub')}</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {unmappedRooms.length === 0 && <div style={{ padding: '34px 22px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>{t('fp_norooms')}</div>}
            {unmappedRooms.map((r) => {
              const on = selected === r.id;
              const bedCount = beds.filter((b) => b.roomId === r.id).length;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 22px', borderBottom: '1px solid #F2F2F6', cursor: 'pointer', background: on ? '#FFFBE6' : '#fff' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{translatePlace(r.name, lang)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{bedCount} {t('places_word')}</div>
                  </div>
                  <span style={{ color: 'var(--color-green)', fontWeight: 800, fontSize: 15, opacity: on ? 1 : 0 }}>✓</span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onCancel} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer' }}>{t('cancel')}</button>
            <button onClick={() => selected && onConfirm(selected)} disabled={!selected} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.5 }}>{t('save')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
