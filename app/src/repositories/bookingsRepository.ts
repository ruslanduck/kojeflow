import { createRepository } from './factory';
import type { Booking } from '@/domain/types';

export const bookingsRepository = createRepository<Booking>('bookings', 'bk-');
