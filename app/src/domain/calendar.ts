import type { Lang } from '@/i18n';

export const MONTHS: Record<Lang, string[]> = {
  EN: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  UK: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
};

export const WEEKDAYS: Record<Lang, string[]> = {
  EN: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  UK: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
};
