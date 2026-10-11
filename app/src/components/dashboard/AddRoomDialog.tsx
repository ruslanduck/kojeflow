'use client';

import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { roomsRepository } from '@/repositories/roomsRepository';
import { Portal } from '@/components/ui/Portal';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';
import type { RoomType } from '@/domain/types';

/** Adds a room with its beds to a property (admins and team members). */
export function AddRoomDialog({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const t = useT();
  const [type, setType] = useState<RoomType>('Room');
  const [number, setNumber] = useState('');
  const [beds, setBeds] = useState('2');
  const [priceInt, setPriceInt] = useState('');
  const [priceExt, setPriceExt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!number.trim()) return setError(t('rm_number'));
    setSaving(true);
    setError('');
    try {
      await roomsRepository.create({
        propertyId,
        type,
        number: number.trim(),
        beds: Math.max(0, Math.min(20, Number(beds) || 0)),
        internalPrice: Number(priceInt) || 0,
        externalPrice: Number(priceExt) || 0,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 120 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="hd" style={{ fontSize: 19 }}>{t('rm_add_title')}</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
            <div>
              <div style={FIELD_LABEL_STYLE}>{t('rm_type')}</div>
              <select value={type} onChange={(e) => setType(e.target.value as RoomType)} style={FIELD_STYLE}>
                {(['Room', 'Apartment', 'Wagon'] as const).map((k) => <option key={k} value={k}>{t(`rm_type_${k}`)}</option>)}
              </select>
            </div>
            <div>
              <div style={FIELD_LABEL_STYLE}>{t('rm_number')} <span style={{ color: 'var(--color-red)' }}>*</span></div>
              <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="12" style={FIELD_STYLE} />
            </div>
            <div>
              <div style={FIELD_LABEL_STYLE}>{t('rm_beds')}</div>
              <input value={beds} onChange={(e) => setBeds(e.target.value)} type="number" min={0} max={20} style={FIELD_STYLE} />
            </div>
            <div />
            <div>
              <div style={FIELD_LABEL_STYLE}>{t('rm_price_int')}</div>
              <input value={priceInt} onChange={(e) => setPriceInt(e.target.value)} type="number" min={0} style={FIELD_STYLE} />
            </div>
            <div>
              <div style={FIELD_LABEL_STYLE}>{t('rm_price_ext')}</div>
              <input value={priceExt} onChange={(e) => setPriceExt(e.target.value)} type="number" min={0} style={FIELD_STYLE} />
            </div>
            {error && <div style={{ gridColumn: '1/-1', fontSize: 12.5, color: 'var(--color-red)' }}>{error}</div>}
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer' }}>{t('cancel')}</button>
            <button onClick={() => void save()} disabled={saving} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? t('saving') : t('save')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
