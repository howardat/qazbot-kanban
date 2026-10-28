"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChartGantt, House, Receipt, Search, Sparkles, Users } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { NavMain } from "@/components/nav-main";
import { NavUpdates } from "@/components/nav-updates";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { SearchDialog } from "@/components/SearchDialog";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import type { Member } from "@/lib/types";

type Board = { id: string; name: string };

/**
 * The app sidebar: shadcn's sidebar-07 block (collapses to icons) wired to Qazbot. The Qazbot wordmark and a
 * white search field on top, the main nav (Team folds open), boards as the projects list, Updates and
 * you at the bottom.
 * ⌘K opens search, ⌘J goes to the assistant.
 */
export function AppSidebar({
  boards,
  counts,
  user,
  isAdmin,
  updatesSeen,
}: {
  boards: Board[];
  counts: Record<string, number>;
  user: Member;
  isAdmin: boolean;
  updatesSeen: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const [searching, setSearching] = useState(false);

  // Following a link on a phone closes the sheet.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setSearching(true);
      }
      if (key === "j") {
        e.preventDefault();
        router.push("/assistant");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const on = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const boardId = pathname.startsWith("/boards/") ? pathname.split("/")[2] : params.get("board");

  return (
    <Sidebar collapsible="icon">
      {/* Wordmark, then search as a white field (both shrink to icons when collapsed) */}
      <SidebarHeader className="gap-2">
        {/* Wordmark with the collapse toggle beside it; collapsed to icons, only the toggle stays. */}
        <div className="flex h-8 items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <Link href="/" aria-label={t.nav.homeAria} className="flex h-8 flex-1 items-center rounded-md px-2 text-[18px] font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden">
            Qazbot
          </Link>
          <SidebarTrigger className="text-muted-foreground" />
        </div>
        <button
          type="button"
          onClick={() => setSearching(true)}
          aria-label={t.search.title}
          title={t.search.title}
          className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border bg-white px-2 text-[14px] text-muted-foreground shadow-xs outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:bg-card group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">{t.search.button}</span>
          <kbd className="font-sans text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">⌘K</kbd>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          label={t.nav.workspace}
          items={[
            { title: t.nav.home, url: "/", icon: <House />, isActive: pathname === "/" },
            { title: t.nav.calendar, url: "/calendar", icon: <CalendarDays />, isActive: on("/calendar") },
            { title: t.nav.timeline, url: "/timeline", icon: <ChartGantt />, isActive: on("/timeline") },
            { title: t.nav.expenses, url: "/expenses", icon: <Receipt />, isActive: on("/expenses") },
            {
              title: t.nav.workers,
              icon: <Users />,
              isActive: on("/workers"),
              items: [
                { title: t.nav.teamDashboard, url: "/workers/team", isActive: pathname === "/workers/team" },
                { title: t.nav.teamOffice, url: "/workers", isActive: pathname === "/workers" },
              ],
            },
            { title: t.nav.assistant, url: "/assistant", icon: <Sparkles />, isActive: on("/assistant"), badge: "⌘J" },
          ]}
        />
        <NavProjects boards={boards} counts={counts} isActive={(id) => boardId === id} />
      </SidebarContent>
      <SidebarFooter>
        <NavUpdates seen={updatesSeen} />
        <NavUser user={user} isAdmin={isAdmin} />
      </SidebarFooter>
      <SidebarRail />
      <SearchDialog open={searching} onOpenChange={setSearching} />
    </Sidebar>
  );
}
