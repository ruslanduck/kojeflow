import { createRepository } from './factory';
import type { FloorPlan } from '@/domain/types';

export const floorPlansRepository = createRepository<FloorPlan>('floorPlans', 'plan-');
