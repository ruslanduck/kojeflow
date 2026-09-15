import { createRepository } from './factory';
import type { Transfer } from '@/domain/types';

export const transfersRepository = createRepository<Transfer>('transfers', 'tr-');
