import { useEntityStore } from '@/store/entities';
import { check, db } from '@/lib/supabase/write';
import { ROOM_TYPE_DB, roomName } from '@/lib/supabase/snapshot';
import type { Bed, Room, RoomType } from '@/domain/types';

export interface NewRoom {
  propertyId: string;
  type: RoomType;
  number: string;
  beds: number;
  internalPrice: number;
  externalPrice: number;
}

/** Rooms (public.rooms): admins and team members add them; removing one archives it with its beds. */
export const roomsRepository = {
  async create(input: NewRoom): Promise<Room> {
    const supabase = db();
    const dbType = ROOM_TYPE_DB[input.type];
    const row = check(
      await supabase
        .from('rooms')
        .insert({
          property_id: input.propertyId,
          number: input.number,
          type: dbType,
          status: 'available',
          internal_price: input.internalPrice || null,
          external_price: input.externalPrice || null,
        })
        .select('id')
        .single(),
      'Save room',
    );
    const places = input.beds > 0
      ? check(
          await supabase
            .from('places')
            .insert(Array.from({ length: input.beds }, (_, i) => ({ room_id: row.id, number: i + 1, status: 'available' })))
            .select('id, number'),
          'Save beds',
        )
      : [];

    const propertyName = useEntityStore.getState().properties.find((p) => p.id === input.propertyId)?.name ?? '';
    const room: Room = {
      id: row.id,
      propertyId: input.propertyId,
      name: roomName(propertyName, dbType, input.number),
      type: input.type,
      priceFrom: input.internalPrice,
      priceTo: input.externalPrice,
      available: true,
    };
    const beds: Bed[] = places.map((pl) => ({
      id: pl.id, roomId: row.id, propertyId: input.propertyId, index: pl.number, status: 'free', residentId: null,
      priceInternal: input.internalPrice, priceExternal: input.externalPrice,
    }));
    useEntityStore.setState((s) => ({ rooms: [...s.rooms, room], beds: [...s.beds, ...beds] }));
    return room;
  },

  /** Takes the room and its beds out of the app; their stays history stays in the database. */
  async archive(roomId: string): Promise<void> {
    const state = useEntityStore.getState();
    if (state.beds.some((b) => b.roomId === roomId && b.status === 'occupied')) throw new Error('err_room_busy');
    const supabase = db();
    check(await supabase.from('places').update({ is_archived: true }).eq('room_id', roomId), 'Remove beds');
    check(await supabase.from('rooms').update({ is_archived: true, status: 'unavailable' }).eq('id', roomId), 'Remove room');
    useEntityStore.setState((s) => ({ rooms: s.rooms.filter((r) => r.id !== roomId), beds: s.beds.filter((b) => b.roomId !== roomId) }));
  },
};
