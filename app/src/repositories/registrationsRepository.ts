import { createRepository } from './factory';
import type { Registration } from '@/domain/types';

export const registrationsRepository = createRepository<Registration>('registrations', 'rg-');
