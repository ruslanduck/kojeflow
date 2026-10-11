import { useEntityStore } from '@/store/entities';
import { check, db } from '@/lib/supabase/write';
import type { Bed } from '@/domain/types';

function requireNotOccupied(bedId: string): Bed {
  const bed = useEntityStore.getState().beds.find((b) => b.id === bedId);
  if (!bed) throw new Error('Bed not found');
  if (bed.status === 'occupied') throw new Error('Only a free bed can be changed');
  return bed;
}

/** Beds (public.places): admins and team members add them, switch free ones off and on, archive them. */
export const bedsRepository = {
  async create(roomId: string): Promise<Bed> {
    const state = useEntityStore.getState();
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) throw new Error('Room not found');
    const number = Math.max(0, ...state.beds.filter((b) => b.roomId === roomId).map((b) => b.index)) + 1;
    const row = check(
      await db().from('places').insert({ room_id: roomId, number, status: 'available' }).select('id').single(),
      'Save bed',
    );
    const bed: Bed = { id: row.id, roomId, propertyId: room.propertyId, index: number, status: room.available ? 'free' : 'unavailable', residentId: null };
    useEntityStore.setState((s) => ({ beds: [...s.beds, bed] }));
    return bed;
  },

  /** Deactivates or reactivates a bed — never one somebody sleeps in. */
  async setAvailable(bedId: string, available: boolean): Promise<void> {
    const bed = requireNotOccupied(bedId);
    check(await db().from('places').update({ status: available ? 'available' : 'unavailable' }).eq('id', bedId), 'Update bed');
    const roomAvailable = useEntityStore.getState().rooms.find((r) => r.id === bed.roomId)?.available ?? true;
    useEntityStore.setState((s) => ({
      beds: s.beds.map((b) => (b.id === bedId ? { ...b, status: available && roomAvailable ? 'free' : 'unavailable' } : b)),
    }));
  },

  /** Removes the bed from the app; its stays history stays in the database. */
  async archive(bedId: string): Promise<void> {
    requireNotOccupied(bedId);
    check(await db().from('places').update({ is_archived: true }).eq('id', bedId), 'Remove bed');
    useEntityStore.setState((s) => ({ beds: s.beds.filter((b) => b.id !== bedId) }));
  },
};
