'use client';

import { create } from 'zustand';
import type { SnapshotMeta } from '@/domain/snapshot';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DataSourceState {
  status: LoadStatus;
  /** Where the loaded data came from, and how much of each table arrived. */
  meta: SnapshotMeta | null;
  error: string | null;
  /** Ids of records created in this session — they exist only here, never in Airtable. */
  localIds: Set<string>;
}

export const useDataSourceStore = create<DataSourceState>(() => ({
  status: 'idle',
  meta: null,
  error: null,
  localIds: new Set(),
}));

export function setLoadStatus(status: LoadStatus, error: string | null = null): void {
  useDataSourceStore.setState({ status, error });
}

export function setSnapshotMeta(meta: SnapshotMeta): void {
  useDataSourceStore.setState({ meta });
}

/** Called by the repositories so the UI can mark session-only records. */
export function markLocal(id: string): void {
  useDataSourceStore.setState((s) => ({ localIds: new Set(s.localIds).add(id) }));
}

export function useIsLocal(id: string): boolean {
  return useDataSourceStore((s) => s.localIds.has(id));
}
