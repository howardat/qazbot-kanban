"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChartGantt, House, Search, Sparkles, Users } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { SearchDialog } from "@/components/SearchDialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import type { Member } from "@/lib/types";

type Board = { id: string; name: string };

/**
 * The app sidebar: shadcn's sidebar-07 block (collapses to icons) wired to Qazbot. The Qazbot wordmark and a
 * white search field on top, the main nav (Team folds open), boards as the projects list, you at the bottom.
 * ⌘K opens search, ⌘J goes to the assistant.
 */
export function AppSidebar({ boards, counts, user, isAdmin }: { boards: Board[]; counts: Record<string, number>; user: Member; isAdmin: boolean }) {
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
        <Link href="/" aria-label={t.nav.homeAria} className="flex h-8 items-center rounded-md px-2 text-[18px] font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="group-data-[collapsible=icon]:hidden">Qazbot</span>
          <span className="hidden group-data-[collapsible=icon]:inline">Q</span>
        </Link>
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
        <NavUser user={user} isAdmin={isAdmin} />
      </SidebarFooter>
      <SidebarRail />
      <SearchDialog open={searching} onOpenChange={setSearching} />
    </Sidebar>
  );
}

/** sidebar-07's header over the page: the sidebar toggle and a breadcrumb for where you are. */
export function SiteHeader({ boards }: { boards: Board[] }) {
  const t = useT();
  const pathname = usePathname();
  const params = useSearchParams();
  const boardName = (id: string | null) => boards.find((b) => b.id === id)?.name;

  // [label, href?] pairs; the last is the current page.
  const crumbs: [string, string?][] = (() => {
    if (pathname === "/") return [[t.nav.home]];
    if (pathname.startsWith("/boards/")) {
      const [, , id, sub] = pathname.split("/");
      const name = boardName(id) ?? t.nav.boards;
      return sub === "list" ? [[t.nav.boards], [name, `/boards/${id}`], [t.views.list]] : [[t.nav.boards], [name]];
    }
    const section = (label: string, href: string): [string, string?][] => {
      const b = boardName(params.get("board"));
      return b ? [[label, href], [b]] : [[label]];
    };
    if (pathname === "/calendar") return section(t.nav.calendar, "/calendar");
    if (pathname === "/timeline") return section(t.nav.timeline, "/timeline");
    if (pathname === "/workers/team") return [[t.nav.workers], [t.nav.teamDashboard]];
    if (pathname === "/workers") return [[t.nav.workers], [t.nav.teamOffice]];
    if (pathname.startsWith("/workers/")) return [[t.nav.workers, "/workers/team"], [t.workers.person]];
    if (pathname.startsWith("/assistant")) return [[t.nav.assistant]];
    const pages: Record<string, string> = { "/usage": t.nav.usage, "/mcp": t.nav.mcp, "/avatar": t.nav.settings, "/admin": t.nav.manageAccess };
    return [[pages[pathname] ?? "Qazbot"]];
  })();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map(([label, href], i) => (
            <span key={i} className="contents">
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage className="font-medium">{label}</BreadcrumbPage>
                ) : href ? (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{label}</span>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
