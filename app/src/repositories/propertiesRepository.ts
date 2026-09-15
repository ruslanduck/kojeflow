import { createRepository } from './factory';
import type { Property } from '@/domain/types';

export const propertiesRepository = createRepository<Property>('properties', 'prop-');
