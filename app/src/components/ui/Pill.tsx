export function Pill({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 11.5, fontWeight: 600, color: fg, background: bg, borderRadius: 20,
        padding: '3px 10px', display: 'inline-block', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
