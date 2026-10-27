import { en, type Dict } from "@/lib/i18n/en";
import { ru } from "@/lib/i18n/ru";

export type { Dict };

export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

/** Cookie holding the viewer's chosen language. Without it, the browser's Accept-Language decides. */
export const LOCALE_COOKIE = "lang";

const DICTS: Record<Locale, Dict> = { en, ru };

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);
export const dictFor = (locale: Locale): Dict => DICTS[locale];

/** First supported language in an Accept-Language header, else English. */
export function localeFromHeader(header: string | null): Locale {
  for (const part of (header ?? "").split(",")) {
    const lang = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(lang)) return lang;
  }
  return "en";
}
