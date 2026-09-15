import { useEntityStore, type EntityState } from '@/store/entities';

function genId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 8);
}

/**
 * Generic async CRUD over one slice of the entity store. Every method is async and
 * shaped like a future `fetch()` call — Stage 2 swaps only the method bodies (to call
 * a real API backed by a database) without touching any calling component. See
 * src/store/entities.ts.
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
