import type { NavKey } from './roles';

/** Page-heading / topbar title keys, distinct from the nav_* sidebar label keys — matches Leglo.dc.html's titleMap. */
export const SCREEN_TITLE_KEY: Record<NavKey, string> = {
  dashboard: 'dash_title',
  floorplan: 'fp_title',
  bookings: 'bk_title',
  checkin: 'ci_title',
  registrations: 'rg_title',
  residents: 'rs_title',
  finances: 'fn_title',
  settings: 'set_title',
};

export const SCREEN_SUB_KEY: Record<NavKey, string> = {
  dashboard: 'dash_sub',
  floorplan: 'fp_sub',
  bookings: 'bk_sub',
  checkin: 'ci_sub',
  registrations: 'rg_sub',
  residents: 'rs_sub',
  finances: 'fn_sub',
  settings: 'set_sub',
};
