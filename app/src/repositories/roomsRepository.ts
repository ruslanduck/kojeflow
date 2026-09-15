import { createRepository } from './factory';
import type { Room } from '@/domain/types';

export const roomsRepository = createRepository<Room>('rooms', 'room-');
