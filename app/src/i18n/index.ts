import en from './data/en.json';
import uk from './data/uk.json';

export type Lang = 'EN' | 'UK';

export const LANG_LABEL: Record<Lang, string> = { EN: 'English', UK: 'Українська' };

/** Merged TX + TX2 dictionaries extracted verbatim from Leglo.dc.html — see app/scripts/. */
export const dictionaries: Record<Lang, Record<string, string>> = {
  EN: en as Record<string, string>,
  UK: uk as Record<string, string>,
};

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[lang];
  let str = dict[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}
