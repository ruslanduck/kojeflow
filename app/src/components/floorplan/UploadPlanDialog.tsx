'use client';

import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { floorPlansRepository } from '@/repositories/floorPlansRepository';
import { Portal } from '@/components/ui/Portal';
import type { FloorPlan } from '@/domain/types';

interface UploadPlanDialogProps {
  propertyId: string;
  nextSort: number;
  onClose: () => void;
  onSaved: (plan: FloorPlan) => void;
}

export function UploadPlanDialog({ propertyId, nextSort, onClose, onSaved }: UploadPlanDialogProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [sort, setSort] = useState(String(nextSort));
  const [imageUrl, setImageUrl] = useState('');
  const [fileName, setFileName] = useState('');

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageUrl(URL.createObjectURL(f));
    setFileName(f.name);
  };

  const canSave = name.trim() !== '' && !!imageUrl;
  const save = async () => {
    if (!canSave) return;
    const plan = await floorPlansRepository.create({ propertyId, name: name.trim(), sort: Number(sort) || 1, imageUrl });
    onSaved(plan);
  };

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 120 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="hd" style={{ fontSize: 19 }}>{t('fp_upload')}</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'grid', gap: 13 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('fp_planname')}</div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="1st Floor" style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('fp_sort')}</div>
              <input type="number" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 }}>{t('fp_image')}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--color-bg)', border: '1px dashed #D6D6DE', borderRadius: 9, padding: 13, cursor: 'pointer', fontSize: 13, color: 'var(--color-muted)' }}>
                <span style={{ fontSize: 16 }}>⇲</span><span>{fileName || t('fp_choosefile')}</span>
                <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
              </label>
            </div>
            {imageUrl && <div style={{ width: '100%', aspectRatio: '1539/679', backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 9 }} />}
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer' }}>{t('cancel')}</button>
            <button onClick={() => void save()} disabled={!canSave} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.5 }}>{t('save')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
