'use client';

import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { floorPlansRepository } from '@/repositories/floorPlansRepository';
import { Portal } from '@/components/ui/Portal';
import type { FloorPlan } from '@/domain/types';

interface PlanSettingsDialogProps {
  plan: FloorPlan;
  onClose: () => void;
  onSaved: () => void;
}

export function PlanSettingsDialog({ plan, onClose, onSaved }: PlanSettingsDialogProps) {
  const t = useT();
  const [name, setName] = useState(plan.name);
  const [sort, setSort] = useState(String(plan.sort));

  const save = async () => {
    if (!name.trim()) return;
    await floorPlansRepository.update(plan.id, { name: name.trim(), sort: Number(sort) || 1 });
    onSaved();
  };

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 120 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="hd" style={{ fontSize: 19 }}>{t('fp_planset')}</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'grid', gap: 13 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('fp_planname')}</div>
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('fp_sort')}</div>
              <input type="number" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
            </div>
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer' }}>{t('cancel')}</button>
            <button onClick={() => void save()} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{t('save')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
