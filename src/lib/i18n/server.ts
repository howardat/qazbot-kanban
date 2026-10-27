import "server-only";
import { cookies, headers } from "next/headers";
import { dictFor, isLocale, LOCALE_COOKIE, localeFromHeader, type Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromHeader((await headers()).get("accept-language"));
}

/** The dictionary for this request's language, for server components and server actions. */
export async function getT() {
  return dictFor(await getLocale());
}
