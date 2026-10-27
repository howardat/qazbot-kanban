"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ChartGantt,
  Check,
  ChevronsUpDown,
  Coins,
  House,
  Languages,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Plus,
  ShieldCheck,
  Sparkles,
  SquareKanban,
  Users,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { setLocale } from "@/app/locale-actions";
import { Avatar } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { NewBoardButton } from "@/components/NewBoardButton";
import { PersonIcon } from "@/components/PersonIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { avatarHue } from "@/lib/colors";
import { dictFor, LOCALES } from "@/lib/i18n";
import type { LatestUpdate } from "@/lib/data";
import { displayName, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

type Board = { id: string; name: string };
type Props = { boards: Board[]; updates: LatestUpdate[]; user: Member; isAdmin: boolean; collapsed: boolean };

/** Cookie remembering a collapsed sidebar; the layout reads it so the first paint already matches. */
export const SIDEBAR_COOKIE = "sidebar";

const NAV = [
  { href: "/", key: "home", Icon: House },
  { href: "/calendar", key: "calendar", Icon: CalendarDays },
  { href: "/timeline", key: "timeline", Icon: ChartGantt },
  { href: "/workers", key: "workers", Icon: Users },
] as const;

// Plane's sidebar row: transparent until hovered, a faint fill when active.
const row = (active: boolean) =>
  cn(
    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0",
    active ? "bg-foreground/[0.06] font-medium text-foreground" : "text-secondary-foreground hover:bg-accent hover:text-foreground",
  );

function useActive() {
  const pathname = usePathname();
  const params = useSearchParams();
  const boardId = pathname.startsWith("/boards/") ? pathname.split("/")[2] : null;
  return {
    nav: (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)),
    board: (id: string) => boardId === id || (pathname !== "/" && params.get("board") === id),
  };
}

/** Square initial chip, tinted per board like Plane's project logos. */
function BoardMark({ board }: { board: Board }) {
  return (
    <span
      aria-hidden
      className="avatar grid size-5 shrink-0 place-items-center rounded-sm text-[10px] font-semibold"
      style={{ "--hue": avatarHue(board.id) } as React.CSSProperties}
    >
      {board.name.trim()[0]?.toUpperCase() ?? "B"}
    </span>
  );
}

function Logo() {
  const t = useT();
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 font-semibold tracking-tight" aria-label={t.nav.homeAria}>
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <SquareKanban className="size-3.5" />
      </span>
      <span className="truncate text-sm">Qazbot</span>
    </Link>
  );
}

function AccountItems({ user, isAdmin }: { user: Member; isAdmin: boolean }) {
  const t = useT();
  return (
    <>
      <DropdownMenuLabel className="font-normal">
        <div className="truncate font-medium">{displayName(user)}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {isAdmin && (
        <DropdownMenuItem asChild>
          <Link href="/admin">
            <ShieldCheck /> {t.nav.manageAccess}
          </Link>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem asChild>
        <Link href="/usage">
          <Coins /> {t.nav.usage}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/mcp">
          <Plug /> {t.nav.mcp}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Languages /> {t.common.language}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {LOCALES.map((l) => (
            <DropdownMenuItem key={l} onSelect={() => setLocale(l)}>
              <Check className={l === t.locale ? "" : "invisible"} /> {dictFor(l).languageName}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem onSelect={() => signOut()}>
        <LogOut /> {t.nav.signOut}
      </DropdownMenuItem>
    </>
  );
}

export function AppSidebar({ boards, updates, user, isAdmin, collapsed: initiallyCollapsed }: Props) {
  const t = useT();
  const active = useActive();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const toggle = () => {
    setCollapsed(!collapsed);
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "open" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
  };
  // Collapsed: icons only, names move to tooltips.
  const label = (text: string) => <span className={cn("truncate", collapsed && "sr-only")}>{text}</span>;
  const railRow = (isActive: boolean) => cn(row(isActive), collapsed && "justify-center px-0");
  // ⌘J / Ctrl+J opens the assistant from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        router.push("/assistant");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      {/* Phones: a slim bar with everything in one menu */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-card px-3 md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <Link
            href="/assistant"
            aria-label={t.assistant.open}
            className="grid size-8 place-items-center rounded-md text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Sparkles className="size-4" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={t.nav.menu}>
              <Menu className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {NAV.map(({ href, key, Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href} className={cn(active.nav(href) && "font-medium")}>
                    <Icon /> {t.nav[key]}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">{t.nav.boards}</DropdownMenuLabel>
              {boards.map((b) => (
                <DropdownMenuItem key={b.id} asChild>
                  <Link href={`/boards/${b.id}`} className={cn(active.board(b.id) && "font-medium")}>
                    <BoardMark board={b} />
                    <span className="truncate">{b.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
              {boards.length === 0 && <DropdownMenuItem disabled>{t.common.noBoards}</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <AccountItems user={user} isAdmin={isAdmin} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Tablets and up: Plane-style sidebar sitting on the canvas */}
      <aside className={cn("hidden shrink-0 flex-col transition-[width] duration-150 md:flex", collapsed ? "w-14" : "w-60")} aria-label={t.nav.sidebar}>
        <div className={cn("flex h-12 items-center", collapsed ? "justify-center" : "justify-between px-3")}>
          {!collapsed && <Logo />}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
            title={collapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
            className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 px-2" aria-label={t.nav.main}>
          {NAV.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              className={railRow(active.nav(href))}
              aria-current={active.nav(href) ? "page" : undefined}
              title={collapsed ? t.nav[key] : undefined}
            >
              <Icon /> {label(t.nav[key])}
            </Link>
          ))}
          <Link href="/assistant" className={railRow(active.nav("/assistant"))} aria-current={active.nav("/assistant") ? "page" : undefined} title={t.assistant.open}>
            <Sparkles className="text-primary" /> {label(t.nav.assistant)}
            {!collapsed && <kbd className="ml-auto font-sans text-[11px] text-muted-foreground">⌘J</kbd>}
          </Link>
        </nav>

        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <div className={cn("flex h-7 items-center", collapsed ? "justify-center" : "justify-between pr-2 pl-4")}>
            {!collapsed && <span className="text-xs font-medium text-muted-foreground">{t.nav.boards}</span>}
            <NewBoardButton
              trigger={
                <button
                  type="button"
                  aria-label={t.nav.newBoard}
                  className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Plus className="size-3.5" />
                </button>
              }
            />
          </div>
          <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-2" aria-label={t.nav.boards}>
            {boards.map((b) => (
              <Link
                key={b.id}
                href={`/boards/${b.id}`}
                className={railRow(active.board(b.id))}
                aria-current={active.board(b.id) ? "page" : undefined}
                title={collapsed ? b.name : undefined}
              >
                <BoardMark board={b} />
                {label(b.name)}
              </Link>
            ))}
            {boards.length === 0 && !collapsed && <p className="px-2 py-1 text-xs text-muted-foreground">{t.common.noBoards}</p>}
          </nav>
        </div>

        {!collapsed && <LatestUpdates updates={updates} />}

        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(railRow(false), "h-10 cursor-pointer")} title={collapsed ? displayName(user) : undefined}>
              <Avatar member={user} size={24} className="ring-0" />
              {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{displayName(user)}</span>}
              {!collapsed && <ChevronsUpDown className="size-3.5! opacity-60" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <AccountItems user={user} isAdmin={isAdmin} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

/** Feed of the latest card moves on any board: which card, where it went, whose it is, how long ago. */
function LatestUpdates({ updates }: { updates: LatestUpdate[] }) {
  const t = useT();
  return (
    <section className="border-t px-2 pt-2 pb-1" aria-label={t.nav.latestUpdates}>
      <h2 className="flex h-6 items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
        <Activity className="size-3.5" /> {t.nav.latestUpdates}
      </h2>
      {updates.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">{t.nav.noUpdates}</p>
      ) : (
        <ol className="max-h-56 overflow-y-auto">
          {updates.map((u) => (
            <li key={u.cardId}>
              <Link href={`/boards/${u.boardId}`} className="flex gap-2 rounded-md px-2 py-1.5 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                {u.assignees[0] ? (
                  <PersonIcon member={u.assignees[0]} size={20} className="mt-0.5" />
                ) : (
                  <span className="mt-0.5 size-5 shrink-0 rounded-full border border-dashed" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{u.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    <span className={cn(u.done && "text-success")}>→ {u.column}</span>
                    {u.assignees.length > 0 && ` · ${u.assignees.map(displayName).join(", ")}`} · {t.fmt.ago(u.at)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
