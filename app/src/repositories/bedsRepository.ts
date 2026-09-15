import { createRepository } from './factory';
import type { Bed } from '@/domain/types';

export const bedsRepository = createRepository<Bed>('beds', 'bed-');
