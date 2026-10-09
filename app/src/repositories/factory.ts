import { useEntityStore, type EntityState } from '@/store/entities';
import { markLocal } from '@/store/dataSource';

function genId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 8);
}

/**
 * Generic async CRUD over one slice of the entity store.
 *
 * The Airtable integration is read-only, so these writes land in the store and
 * nowhere else: they live until reload and are tagged via markLocal() so the UI can
 * say so rather than implying the record reached the base.
 */
export function createRepository<T extends { id: string }>(key: keyof EntityState, idPrefix: string) {
  return {
    async list(): Promise<T[]> {
      return useEntityStore.getState()[key] as unknown as T[];
    },
    async get(id: string): Promise<T | undefined> {
      return (useEntityStore.getState()[key] as unknown as T[]).find((x) => x.id === id);
    },
    async create(input: Omit<T, 'id'>): Promise<T> {
      const record = { ...input, id: genId(idPrefix) } as T;
      useEntityStore.setState((s) => ({ [key]: [record, ...(s[key] as unknown as T[])] }) as Partial<EntityState>);
      markLocal(record.id);
      return record;
    },
    async update(id: string, patch: Partial<T>): Promise<T> {
      let updated: T | undefined;
      useEntityStore.setState((s) => {
        const list = (s[key] as unknown as T[]).map((x) => {
          if (x.id !== id) return x;
          updated = { ...x, ...patch };
          return updated;
        });
        return { [key]: list } as Partial<EntityState>;
      });
      if (!updated) throw new Error(`${String(key)} record not found: ${id}`);
      return updated;
    },
    async remove(id: string): Promise<void> {
      useEntityStore.setState((s) => ({ [key]: (s[key] as unknown as T[]).filter((x) => x.id !== id) }) as Partial<EntityState>);
    },
  };
}
