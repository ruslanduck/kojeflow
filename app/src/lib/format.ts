/** Matches Component.fmt(n): symbol-suffixed for Kč/zł, prefixed otherwise. */
export function formatCurrency(amount: number, currency: string): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.abs(amount).toLocaleString('en-US');
  return currency === 'Kč' || currency === 'zł' ? `${sign}${digits} ${currency}` : `${sign}${currency}${digits}`;
}

export function formatDateDMY(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
}
