import en from './data/en.json';
import uk from './data/uk.json';

export type Lang = 'EN' | 'UK';

export const LANG_LABEL: Record<Lang, string> = { EN: 'English', UK: 'Українська' };

/** Merged TX + TX2 dictionaries extracted verbatim from Leglo.dc.html — see app/scripts/. */
export const dictionaries: Record<Lang, Record<string, string>> = {
  EN: en as Record<string, string>,
  UK: uk as Record<string, string>,
};

const pluralRules: Record<Lang, Intl.PluralRules> = { EN: new Intl.PluralRules('en'), UK: new Intl.PluralRules('uk') };

/** A numeric {n} picks the key's plural form when one exists ("doc_n_one", Ukrainian "_few"/"_many"). */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[lang];
  const n = vars?.n;
  const form = typeof n === 'number' ? dict[`${key}_${pluralRules[lang].select(n)}`] : undefined;
  let str = form ?? dict[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}
