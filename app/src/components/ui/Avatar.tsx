import { initials } from '@/lib/text';

/** Photo upload isn't built yet (task 11), so this always renders the initials fallback. */
export function Avatar({ name, size = 30, onClick }: { name: string; size?: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, flex: 'none', borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#F1F1F5',
        fontSize: Math.round(size * 0.42), color: 'var(--color-muted)', fontWeight: 700,
        boxShadow: 'inset 0 0 0 1px rgba(20,20,20,.06)',
      }}
    >
      {initials(name)}
    </div>
  );
}
