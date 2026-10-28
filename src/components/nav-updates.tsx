"use client";

import { useState } from "react";
import { Megaphone, MessageSquareWarning } from "lucide-react";
import { markUpdatesSeen } from "@/app/updates-actions";
import { useT } from "@/components/I18nProvider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { isLocale } from "@/lib/i18n";
import { LATEST_RELEASE, RELEASES, type ChangeKind } from "@/lib/updates";
import { cn } from "@/lib/utils";

const ISSUES_URL = "https://github.com/howardat/qazbot-kanban/issues/new";

const KIND_TONE: Record<ChangeKind, string> = {
  new: "bg-primary/10 text-primary",
  improved: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  fixed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

/**
 * Updates, just above the user card: a violet dot while there is a release this person hasn't opened.
 * Opening it shows a changelog, releases on the left and the picked one's changes on the right, and
 * marks everything read. Under it, a link to the GitHub issues page for bug reports and suggestions.
 */
export function NavUpdates({ seen }: { seen: string | null }) {
  const t = useT();
  const locale = isLocale(t.locale) ? t.locale : "en";
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(seen !== LATEST_RELEASE);
  const [picked, setPicked] = useState(LATEST_RELEASE);
  const release = RELEASES.find((r) => r.id === picked) ?? RELEASES[0];
  const date = (iso: string, month: "long" | "short") =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month, year: month === "long" ? "numeric" : undefined });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setPicked(LATEST_RELEASE);
    if (unread) {
      setUnread(false);
      void markUpdatesSeen();
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={t.updates.title} onClick={() => onOpenChange(true)} aria-label={unread ? t.updates.unreadAria : t.updates.title}>
          <span className="relative flex">
            <Megaphone />
            {unread && <span className="absolute -top-0.5 -right-0.5 hidden size-2 rounded-full bg-primary ring-2 ring-sidebar group-data-[collapsible=icon]:block" />}
          </span>
          <span>{t.updates.title}</span>
          {unread && <span aria-hidden className="ml-auto size-2 rounded-full bg-primary" />}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={t.updates.feedback}>
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            <MessageSquareWarning />
            <span>{t.updates.feedback}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(520px,85dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <div className="shrink-0 border-b px-5 py-3.5 pr-12">
            <DialogTitle className="text-[15px] font-semibold">{t.updates.title}</DialogTitle>
            <DialogDescription className="text-[13px]">{t.updates.description}</DialogDescription>
          </div>
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {/* Releases: a row of chips on a phone, a list down the side otherwise */}
            <nav aria-label={t.updates.all} className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 sm:w-60 sm:flex-col sm:overflow-y-auto sm:border-r sm:border-b-0">
              {RELEASES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPicked(r.id)}
                  aria-current={r.id === release.id ? "true" : undefined}
                  className={cn(
                    "flex shrink-0 cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:shrink",
                    r.id === release.id && "bg-accent",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {date(r.date, "short")}
                    {r.id === LATEST_RELEASE && <span className="rounded bg-primary/10 px-1 font-medium text-primary">{t.updates.latest}</span>}
                  </span>
                  <span className={cn("max-w-48 truncate text-[13px] sm:max-w-none sm:whitespace-normal", r.id === release.id ? "font-medium text-foreground" : "text-foreground/80")}>
                    {r.title[locale]}
                  </span>
                </button>
              ))}
            </nav>
            <article className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <time dateTime={release.date} className="text-xs text-muted-foreground">
                {date(release.date, "long")}
              </time>
              <h3 className="mt-1 text-lg leading-snug font-semibold tracking-tight">{release.title[locale]}</h3>
              <ul className="mt-4 divide-y rounded-lg border">
                {release.changes.map((c) => (
                  <li key={c.text.en} className="flex items-start gap-3 px-3.5 py-2.5">
                    <span className={cn("mt-px w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium", KIND_TONE[c.kind])}>{t.updates.kind[c.kind]}</span>
                    <span className="text-[13px] leading-relaxed text-foreground/90">{c.text[locale]}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
