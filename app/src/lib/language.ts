'use client';

import type { Lang } from '@/i18n';
import { createClient } from '@/lib/supabase/client';

const KEY = 'kf_lang';

/** The language last used on this device; the login page has no profile to read it from. */
export function savedLanguage(): Lang | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'EN' || value === 'UK' ? value : null;
  } catch {
    return null;
  }
}

export function rememberLanguage(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Private mode or blocked storage: the profile still keeps the choice.
  }
}

/** Keeps the choice on this device and in the profile, so the user's other devices follow. */
export async function saveLanguage(lang: Lang): Promise<void> {
  rememberLanguage(lang);
  const { error } = await createClient().rpc('set_my_language', { lang: lang === 'UK' ? 'uk' : 'en' });
  if (error) throw new Error(error.message);
}
