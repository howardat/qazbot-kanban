"use client";

import Link from "next/link";
import { CalendarDays, ChartGantt, Columns3, List, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { BoardIcon } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { NewBoardButton } from "@/components/NewBoardButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

/** sidebar-07's projects list, as our boards: icon, name, open-card count; "…" on hover opens a view. */
export function NavProjects({
  boards,
  counts,
  isActive,
}: {
  boards: { id: string; name: string }[];
  counts: Record<string, number>;
  isActive: (id: string) => boolean;
}) {
  const t = useT();
  const { isMobile } = useSidebar();
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t.nav.boards}</SidebarGroupLabel>
      <NewBoardButton
        trigger={
          <SidebarGroupAction title={t.nav.newBoard} aria-label={t.nav.newBoard}>
            <PlusIcon />
          </SidebarGroupAction>
        }
      />
      <SidebarMenu>
        {boards.map((b) => (
          <SidebarMenuItem key={b.id}>
            <SidebarMenuButton asChild isActive={isActive(b.id)}>
              <Link href={`/boards/${b.id}`}>
                <BoardIcon board={b} size={16} />
                <span>{b.name}</span>
              </Link>
            </SidebarMenuButton>
            {/* The count steps aside on hover for the "…" menu */}
            {!!counts[b.id] && (
              <SidebarMenuBadge className="font-sans text-[12px] font-normal text-muted-foreground tabular-nums group-hover/menu-item:opacity-0">{counts[b.id]}</SidebarMenuBadge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover className="aria-expanded:bg-muted">
                  <MoreHorizontalIcon />
                  <span className="sr-only">{t.board.options}</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 rounded-lg" side={isMobile ? "bottom" : "right"} align={isMobile ? "end" : "start"}>
                <DropdownMenuItem asChild>
                  <Link href={`/boards/${b.id}`}>
                    <Columns3 className="text-muted-foreground" /> {t.views.board}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/boards/${b.id}/list`}>
                    <List className="text-muted-foreground" /> {t.views.list}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/calendar?board=${b.id}`}>
                    <CalendarDays className="text-muted-foreground" /> {t.views.calendar}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/timeline?board=${b.id}`}>
                    <ChartGantt className="text-muted-foreground" /> {t.views.timeline}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        {boards.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">{t.common.noBoards}</p>}
      </SidebarMenu>
    </SidebarGroup>
  );
}
