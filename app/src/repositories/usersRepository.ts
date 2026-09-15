import { createRepository } from './factory';
import type { User } from '@/domain/types';

export const usersRepository = createRepository<User>('users', 'user-');
