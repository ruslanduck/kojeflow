import { createRepository } from './factory';
import type { Stay } from '@/domain/types';

export const staysRepository = createRepository<Stay>('stays', 'st-');
