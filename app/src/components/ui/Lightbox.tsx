'use client';

import { Portal } from './Portal';

export function Lightbox({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(12,12,14,.92)', display: 'flex', flexDirection: 'column', zIndex: 200, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
          <div className="hd" style={{ fontSize: 19, color: '#fff' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', borderRadius: '50%', width: 34, height: 34, fontSize: 19, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, backgroundImage: `url("${url}")`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      </div>
    </Portal>
  );
}
