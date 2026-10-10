import { useEntityStore } from '@/store/entities';
import { check, db, pct } from '@/lib/supabase/write';
import type { FloorZone } from '@/domain/types';

type Rect = Pick<FloorZone, 'x' | 'y' | 'w' | 'h'>;

const toRow = (rect: Rect) => ({ x: pct(rect.x), y: pct(rect.y), w: pct(rect.w), h: pct(rect.h) });

function setZone(id: string, rect: Rect) {
  useEntityStore.setState((s) => ({ floorZones: s.floorZones.map((z) => (z.id === id ? { ...z, ...rect } : z)) }));
}

/** Room zones on a floor plan, stored in public.floor_zones. */
export const floorZonesRepository = {
  async create(input: Omit<FloorZone, 'id'>): Promise<FloorZone> {
    const inserted = check(
      await db().from('floor_zones').insert({ plan_id: input.planId, room_id: input.roomId, ...toRow(input) }).select('id').single(),
      'Save zone',
    );
    const zone: FloorZone = { ...input, ...toRow(input), id: inserted.id };
    useEntityStore.setState((s) => ({ floorZones: [...s.floorZones, zone] }));
    return zone;
  },

  /** Moves the zone on screen only, while it is being dragged; `update` saves where it lands. */
  preview(id: string, rect: Rect): void {
    setZone(id, rect);
  },

  async update(id: string, rect: Rect): Promise<void> {
    check(await db().from('floor_zones').update(toRow(rect)).eq('id', id), 'Save zone');
    setZone(id, toRow(rect));
  },

  async remove(id: string): Promise<void> {
    check(await db().from('floor_zones').delete().eq('id', id), 'Delete zone');
    useEntityStore.setState((s) => ({ floorZones: s.floorZones.filter((z) => z.id !== id) }));
  },
};
