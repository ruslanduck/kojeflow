'use client';

import { useState } from 'react';
import { useEntityStore } from '@/store/entities';
import { initials } from '@/lib/text';
import { Lightbox } from './Lightbox';

/**
 * Looks up a photo by exact resident-name match against the entity store, so every
 * call site automatically shows the uploaded avatar without threading a prop through —
 * matches the prototype's own av() helper, which resolves photos (and zoom-to-lightbox)
 * by name everywhere. A masked name (Client role) won't match any resident, so no photo
 * — and no zoom — ever leaks.
 */
export function Avatar({ name, size = 30, onClick }: { name: string; size?: number; onClick?: () => void }) {
  const photoUrl = useEntityStore((s) => s.residents.find((r) => r.name === name)?.avatarUrl);
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <div
        onClick={(e) => {
          if (photoUrl) {
            e.stopPropagation();
            setZoomed(true);
          }
          onClick?.();
        }}
        style={{
          width: size, height: size, flex: 'none', borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          background: '#F1F1F5',
          backgroundImage: photoUrl ? `url("${photoUrl}")` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
          fontSize: Math.round(size * 0.42), color: 'var(--color-muted)', fontWeight: 700,
          boxShadow: 'inset 0 0 0 1px rgba(20,20,20,.06)', cursor: photoUrl ? 'zoom-in' : onClick ? 'pointer' : undefined,
        }}
      >
        {!photoUrl && initials(name)}
      </div>
      {zoomed && photoUrl && <Lightbox url={photoUrl} title={name} onClose={() => setZoomed(false)} />}
    </>
  );
}
