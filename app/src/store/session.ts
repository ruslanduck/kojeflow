'use client';

import { create } from 'zustand';
import type { Lang } from '@/i18n';
import type { RoleName } from '@/domain/roles';

interface SessionState {
  role: RoleName;
  lang: Lang;
  currency: string;
  profileName: string;
  toast: string | null;
  sheetOpen: boolean;
  setRole: (role: RoleName) => void;
  setLang: (lang: Lang) => void;
  setCurrency: (currency: string) => void;
  setProfileName: (name: string) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  openSheet: () => void;
  closeSheet: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  role: 'Administrator',
  lang: 'EN',
  currency: 'Kč',
  profileName: 'Anna Kovalenko',
  toast: null,
  sheetOpen: false,
  setRole: (role) => set({ role }),
  setLang: (lang) => set({ lang }),
  setCurrency: (currency) => set({ currency }),
  setProfileName: (profileName) => set({ profileName }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  openSheet: () => set({ sheetOpen: true }),
  closeSheet: () => set({ sheetOpen: false }),
}));
