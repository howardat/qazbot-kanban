"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Plane's calendar "Options" menu: month or week layout, and whether weekends show. Both live in the URL. */
export function CalendarOptions({ view, weekends }: { view: "month" | "week"; weekends: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    return `${pathname}?${next}`;
  };
  const tick = (on: boolean) => <Check className={on ? "" : "invisible"} />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {view === "week" ? t.calendar.week : t.calendar.month} <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t.calendar.layout}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={href({ view: null, date: null })}>{tick(view === "month")} {t.calendar.month}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={href({ view: "week", month: null })}>{tick(view === "week")} {t.calendar.week}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={href({ weekends: weekends ? "0" : null })}>{tick(weekends)} {t.calendar.weekends}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
