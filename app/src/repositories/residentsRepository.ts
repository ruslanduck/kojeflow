import { createRepository } from './factory';
import type { Resident } from '@/domain/types';

export const residentsRepository = createRepository<Resident>('residents', 'res-');
