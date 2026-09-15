import { createRepository } from './factory';
import type { FloorZone } from '@/domain/types';

export const floorZonesRepository = createRepository<FloorZone>('floorZones', 'zone-');
