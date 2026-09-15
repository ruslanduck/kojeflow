import { useEntityStore } from '@/store/entities';
import { rateFor, TODAY } from '@/domain/logic';
import type { Stay } from '@/domain/types';

function genId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 8);
}

export interface CheckInInput {
  residentId: string;
  residentName: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  type: Stay['type'];
  manager: string;
  project: string;
  checkIn?: string;
}

/** Assigns a free bed to a resident: creates the Stay and flips the Bed to occupied. */
export async function checkIn(input: CheckInInput): Promise<Stay> {
  const state = useEntityStore.getState();
  const bed = state.beds.find((b) => b.id === input.bedId);
  if (!bed) throw new Error('Bed not found: ' + input.bedId);
  if (bed.status !== 'free' && bed.status !== 'booked') throw new Error('Bed is not available: ' + input.bedId);
  const room = state.rooms.find((r) => r.id === input.roomId);
  const property = state.properties.find((p) => p.id === input.propertyId);
  const basePrice = property?.price ?? 220;
  const bedLabel = `${room?.name ?? ''} · Place ${bed.index}`;

  const stay: Stay = {
    id: genId('st-'),
    residentId: input.residentId,
    residentName: input.residentName,
    propertyId: input.propertyId,
    roomId: input.roomId,
    bedId: input.bedId,
    type: input.type,
    manager: input.manager,
    project: input.project,
    checkIn: input.checkIn ?? TODAY,
    checkOut: null,
    status: 'active',
    rate: rateFor(basePrice, property?.name ?? input.propertyId, bedLabel),
  };

  useEntityStore.setState((s) => ({
    stays: [stay, ...s.stays],
    beds: s.beds.map((b) => (b.id === bed.id ? { ...b, status: 'occupied', residentId: input.residentId } : b)),
  }));

  return stay;
}

/**
 * Closes an active stay and frees its bed. Not present in the design prototype
 * (which only has check-in) — added as the sensible default for the missing
 * vacate flow, flagged in the build plan.
 */
export async function checkOut(stayId: string, checkOutDate: string = TODAY): Promise<Stay> {
  const state = useEntityStore.getState();
  const stay = state.stays.find((s) => s.id === stayId);
  if (!stay) throw new Error('Stay not found: ' + stayId);
  if (stay.status === 'checked-out') return stay;

  const updated: Stay = { ...stay, status: 'checked-out', checkOut: checkOutDate };

  useEntityStore.setState((s) => ({
    stays: s.stays.map((x) => (x.id === stayId ? updated : x)),
    beds: s.beds.map((b) => (b.id === stay.bedId ? { ...b, status: 'free', residentId: null } : b)),
  }));

  return updated;
}
