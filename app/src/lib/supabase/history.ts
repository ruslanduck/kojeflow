'use client';

import { useEffect, useState } from 'react';
import { createClient } from './client';

/** Beds held per property on a past day (public.occupancy_on); null while loading or for today. */
export function useOccupancyOn(day: string | null): Map<string, number> | null {
  const [result, setResult] = useState<{ day: string; byProperty: Map<string, number> } | null>(null);

  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    createClient()
      .rpc('occupancy_on', { day })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const rows = (data ?? []) as { property_id: string; occupied: number }[];
        setResult({ day, byProperty: new Map(rows.map((r) => [r.property_id, r.occupied])) });
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  return day && result?.day === day ? result.byProperty : null;
}

export interface RoomHistoryRow {
  stayId: string;
  residentId: string;
  name: string;
  gender: 'M' | 'F';
  placeNumber: number;
  checkIn: string;
  checkOut: string | null;
  active: boolean;
}

/** Everyone who has lived in a room, newest first (public.room_history); null while loading. */
export function useRoomHistory(roomId: string): RoomHistoryRow[] | null {
  const [result, setResult] = useState<{ roomId: string; rows: RoomHistoryRow[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .rpc('room_history', { room: roomId })
      .then(({ data, error }) => {
        if (cancelled) return;
        const rows = error ? [] : ((data ?? []) as Record<string, unknown>[]);
        setResult({
          roomId,
          rows: rows.map((r) => ({
            stayId: String(r.stay_id),
            residentId: String(r.tenant_id),
            name: String(r.tenant_name ?? ''),
            gender: r.gender === 'female' ? 'F' : 'M',
            placeNumber: Number(r.place_number),
            checkIn: String(r.check_in ?? ''),
            checkOut: r.check_out ? String(r.check_out) : null,
            active: r.status === 'active',
          })),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return result?.roomId === roomId ? result.rows : null;
}
