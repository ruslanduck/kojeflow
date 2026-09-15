import rolesData from './data/roles.json';

export type NavKey =
  | 'dashboard'
  | 'floorplan'
  | 'bookings'
  | 'checkin'
  | 'registrations'
  | 'residents'
  | 'finances'
  | 'settings';

export type RoleName = 'Administrator' | 'Company employee' | 'Commandant' | 'Client';

export interface RoleConfig {
  nav: NavKey[];
  balance: boolean;
  planner?: boolean;
  ownHostel?: string;
  hideNames?: boolean;
  ownOnly?: boolean;
}

export const ROLES: Record<RoleName, RoleConfig> = rolesData as Record<RoleName, RoleConfig>;

export const ROLE_NAMES = Object.keys(ROLES) as RoleName[];

export function roleLabelKey(role: RoleName): string {
  return 'role_' + role.replace(/\s/g, '');
}

export const NAV_LABEL_KEY: Record<NavKey, string> = {
  dashboard: 'nav_dashboard',
  floorplan: 'nav_floorplan',
  bookings: 'nav_bookings',
  checkin: 'nav_checkin',
  registrations: 'nav_registrations',
  residents: 'nav_residents',
  finances: 'nav_finances',
  settings: 'nav_settings',
};

export const NAV_ROUTE: Record<NavKey, string> = {
  dashboard: '/dashboard',
  floorplan: '/floorplan',
  bookings: '/bookings',
  checkin: '/checkin',
  registrations: '/registrations',
  residents: '/residents',
  finances: '/finance',
  settings: '/settings',
};
