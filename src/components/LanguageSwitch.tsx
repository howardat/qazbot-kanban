"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/locale-actions";
import { useT } from "@/components/I18nProvider";
import { dictFor, LOCALES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Compact language toggle for signed-out pages; signed-in users switch from the account menu. */
export function LanguageSwitch() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center justify-center gap-1 text-xs" role="group" aria-label={t.common.language}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={l === t.locale}
          onClick={() => startTransition(() => setLocale(l))}
          className={cn(
            "cursor-pointer rounded-md px-2 py-1 transition-colors",
            l === t.locale ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {dictFor(l).languageName}
        </button>
      ))}
    </div>
  );
}
