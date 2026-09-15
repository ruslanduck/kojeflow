'use client';

import { useSessionStore } from '@/store/session';
import { translate } from './index';

export function useT() {
  const lang = useSessionStore((s) => s.lang);
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
