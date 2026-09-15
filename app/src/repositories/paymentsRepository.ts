import { createRepository } from './factory';
import type { Payment } from '@/domain/types';

export const paymentsRepository = createRepository<Payment>('payments', 'pm-');
