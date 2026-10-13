/** Matches Component.fmt(n): symbol-suffixed for Kč/zł, prefixed otherwise. */
export function formatCurrency(amount: number, currency: string): string {
  const sign = amount < 0 ? '-' : '';
  // Czech grouping ("108 667"), the way crowns are written; reads right in Ukrainian too.
  const digits = Math.abs(amount).toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
  return currency === 'Kč' || currency === 'zł' ? `${sign}${digits} ${currency}` : `${sign}${currency}${digits}`;
}

export function formatDateDMY(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}
