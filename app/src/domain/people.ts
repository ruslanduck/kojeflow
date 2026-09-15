import pools from './data/name-pools.json';

export const MANAGERS: string[] = pools.MANAGERS;
export const PROJECTS: string[] = pools.PROJECTS;
export const MANAGER_PROJECTS: Record<string, string[]> = pools.MANAGER_PROJECTS;
