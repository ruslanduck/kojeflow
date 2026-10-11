/** Errors thrown with a dictionary key ("err_bed_taken") show translated; any other message shows as is. */
export function errorText(e: unknown, t: (key: string) => string): string {
  return t(e instanceof Error ? e.message : String(e));
}
