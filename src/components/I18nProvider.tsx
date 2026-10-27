"use client";

import { createContext, useContext } from "react";
import { dictFor, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("en");

/** Passes the request's language to client components (dictionaries hold functions, so only the code crosses). */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useT() {
  return dictFor(useContext(LocaleContext));
}
