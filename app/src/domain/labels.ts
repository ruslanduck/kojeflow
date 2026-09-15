import type { Lang } from '@/i18n';
import { hashString } from './logic';

/** Ports Component.safeName: masks a resident's real name for roles with hideNames (Client). */
export function safeName(name: string, hideNames: boolean, hiddenLabel: string): string {
  if (!hideNames) return name;
  return `${hiddenLabel} #${(hashString(name) % 900) + 100}`;
}

/**
 * Ports Component.trPlace(v): room/bed label strings are authored in English
 * ("Room 1 · Place 2") and translated by direct word substitution, matching the
 * prototype exactly (including English's own Wagon->Container, Place->Bed swap).
 */
export function translatePlace(value: string | null | undefined, lang: Lang): string {
  if (!value) return value ?? '';
  if (lang === 'EN') return value.replace(/Wagon/g, 'Container').replace(/Place/g, 'Bed');
  return value
    .replace(/Apartment/g, 'Квартира')
    .replace(/Apt/g, 'Кв.')
    .replace(/Wagon/g, 'Контейнер')
    .replace(/Room/g, 'Кімната')
    .replace(/Place/g, 'Ліжко')
    .replace(/Bed/g, 'Ліжко')
    .replace(/not assigned/g, 'не призначено');
}

export const TYPE_LABEL_KEY: Record<string, string> = {
  Internal: 'type_Internal',
  Commercial: 'type_Commercial',
  Free: 'type_Free',
  Paid: 'type_Paid',
};

export const STATUS_LABEL_KEY: Record<string, string> = {
  New: 'st_New',
  Registered: 'st_Registered',
  'Checked-in': 'st_CheckedIn',
  Cancelled: 'st_Cancelled',
  Expired: 'st_Expired',
  'Handed over': 'st_HandedOver',
  Accepted: 'st_Accepted',
};

export const ROOM_GENDER_LABEL_KEY: Record<string, string> = {
  M: 'g_male_r',
  F: 'g_female_r',
  X: 'g_mixed_r',
  N: 'g_open_r',
};

/** Pill background/foreground pairs, ported from Component.typeStyle/statusStyle/genderStyle. */
export const TYPE_PILL: Record<string, [fg: string, bg: string]> = {
  Internal: ['#7A0F7A', '#FBE3FB'],
  Free: ['#7A0F7A', '#FBE3FB'],
  Commercial: ['#6B5300', '#FFF3B8'],
  Paid: ['#6B5300', '#FFF3B8'],
};
export const DEFAULT_PILL: [string, string] = ['#5C5C66', '#EDEDF2'];

export const STATUS_PILL: Record<string, [fg: string, bg: string]> = {
  New: ['#6B5300', '#FFF3B8'],
  Registered: ['#1B7F52', '#E4F6EC'],
  'Checked-in': ['#1B7F52', '#E4F6EC'],
  Expired: ['#C0392B', '#FDECEC'],
  Cancelled: ['#5C5C66', '#EDEDF2'],
  'Handed over': ['#6B5300', '#FFF3B8'],
  Accepted: ['#1B7F52', '#E4F6EC'],
};

export const GENDER_EMOJI: Record<string, string> = { M: '👨', F: '👩', X: '🧑‍🤝‍🧑', N: '👤' };

export const ROOM_GENDER_PILL: Record<string, [fg: string, bg: string]> = {
  M: ['#1D4F91', '#E6EEFA'],
  F: ['#A0126F', '#FBE3F2'],
  X: ['#7A0F7A', '#FBE3FB'],
  N: ['#5C5C66', '#EDEDF2'],
};
