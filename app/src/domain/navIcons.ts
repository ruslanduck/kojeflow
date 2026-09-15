import tabIcons from './data/tab-icons.json';
import type { NavKey } from './roles';

export type IconKey = NavKey | 'profile';

/** Each value is one or more SVG path `d` attributes joined by `|`, taken verbatim from Leglo.dc.html's TAB_ICONS. */
export const TAB_ICONS: Record<IconKey, string> = tabIcons as Record<IconKey, string>;

export function iconPaths(key: IconKey): string[] {
  return (TAB_ICONS[key] ?? TAB_ICONS.profile).split('|');
}
