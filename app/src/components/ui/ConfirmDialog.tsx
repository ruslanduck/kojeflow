'use client';

import { useT } from '@/i18n/useT';
import { Portal } from './Portal';

interface ConfirmDialogProps {
  title: string;
  sub: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, sub, onCancel, onConfirm }: ConfirmDialogProps) {
  const t = useT();
  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 130 }} onClick={onCancel}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 370, overflow: 'hidden' }}>
          <div style={{ padding: '22px 22px 16px' }}>
            <div className="hd" style={{ fontSize: 18, marginBottom: 5 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>{sub}</div>
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onCancel} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer' }}>{t('cancel')}</button>
            <button onClick={onConfirm} style={{ background: 'var(--color-red)', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{t('confirm')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
