'use client';

import { create } from 'zustand';
import type { Lang } from '@/i18n';
import type { RoleName } from '@/domain/roles';

interface SessionState {
  /** Role the UI renders as; admins may switch it to preview other roles. */
  role: RoleName;
  /** Role of the signed-in account, from its Supabase profile. */
  actualRole: RoleName | null;
  /** Properties a house manager or client is limited to. */
  ownPropertyIds: string[];
  setCurrentUser: (user: { name: string; role: RoleName; propertyIds: string[] }) => void;
  lang: Lang;
  currency: string;
  profileName: string;
  toast: string | null;
  sheetOpen: boolean;
  /** Verification mode: flags values whose Airtable source is unknown or ambiguous. */
  showMapping: boolean;
  toggleMapping: () => void;
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
  role: 'Client',
  actualRole: null,
  ownPropertyIds: [],
  setCurrentUser: ({ name, role, propertyIds }) =>
    set({ profileName: name, role, actualRole: role, ownPropertyIds: propertyIds }),
  lang: 'EN',
  currency: 'Kč',
  profileName: '',
  toast: null,
  sheetOpen: false,
  // Airtable mapping flags; data now comes from Supabase, so they start hidden.
  showMapping: false,
  toggleMapping: () => set((s) => ({ showMapping: !s.showMapping })),
  setRole: (role) => set({ role }),
  setLang: (lang) => set({ lang }),
  setCurrency: (currency) => set({ currency }),
  setProfileName: (profileName) => set({ profileName }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  openSheet: () => set({ sheetOpen: true }),
  closeSheet: () => set({ sheetOpen: false }),
}));
