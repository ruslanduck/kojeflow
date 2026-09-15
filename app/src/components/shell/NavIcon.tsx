import { iconPaths, type IconKey } from '@/domain/navIcons';

export function NavIcon({ icon, size = 21 }: { icon: IconKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths(icon).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
