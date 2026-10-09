'use client';

import { create } from 'zustand';
import { emptyBundle, type EntityBundle } from '@/domain/snapshot';

export type EntityState = EntityBundle;

/**
 * In-memory entity store, hydrated from Airtable by
 * src/components/data/DataProvider.tsx on first mount. It starts empty — nothing
 * renders real values until that fetch resolves.
 *
 * Writes (check-in, payments, bookings, transfers) still go through
 * src/repositories/ and land here only: the integration is read-only, so anything
 * created in-session lives until reload and is marked as such in the UI.
 */
export const useEntityStore = create<EntityState>(() => emptyBundle());

export function hydrateEntities(entities: EntityBundle): void {
  useEntityStore.setState(entities, true);
}
