'use client';

import { useMemo } from 'react';
import { ROLES } from '@/domain/roles';
import { useSessionStore } from './session';
import { useEntityStore } from './entities';

/**
 * Properties a property-bound role (house manager) works with, or null for roles that see every
 * property. A real house manager gets the properties assigned to them; an admin previewing the
 * role gets the first property, so the preview looks like a house manager's screen.
 */
export function useScopedPropertyIds(): Set<string> | null {
  const role = useSessionStore((s) => s.role);
  const actualRole = useSessionStore((s) => s.actualRole);
  const ownPropertyIds = useSessionStore((s) => s.ownPropertyIds);
  const properties = useEntityStore((s) => s.properties);
  return useMemo(() => {
    if (!ROLES[role].scoped) return null;
    if (actualRole === role) return new Set(ownPropertyIds);
    return new Set(properties.slice(0, 1).map((p) => p.id));
  }, [role, actualRole, ownPropertyIds, properties]);
}
