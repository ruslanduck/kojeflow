'use client';

import { useT } from '@/i18n/useT';
import { Portal } from './Portal';

interface ConfirmDialogProps {
  title: string;
  sub: string;
  /** Label of the destructive action. Defaults to the generic "Confirm". */
  confirmLabel?: string;
  /** Label of the dismiss action. Defaults to the generic "Cancel". */
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, sub, confirmLabel, cancelLabel, tone = 'danger', onCancel, onConfirm }: ConfirmDialogProps) {
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
            <button onClick={onCancel} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer' }}>{cancelLabel ?? t('cancel')}</button>
            <button onClick={onConfirm} style={{ background: tone === 'danger' ? 'var(--color-red)' : '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{confirmLabel ?? t('confirm')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
