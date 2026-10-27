"use client";

import Link from "next/link";
import { Check, ChevronsUpDownIcon, Coins, Languages, LogOutIcon, Plug, Settings, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { setLocale } from "@/app/locale-actions";
import { Avatar } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { dictFor, LOCALES } from "@/lib/i18n";
import { displayName, type Member } from "@/lib/types";

/** sidebar-07's user card at the bottom: avatar, name, email; the menu holds account pages, language, sign out. */
export function NavUser({ user, isAdmin }: { user: Member; isAdmin: boolean }) {
  const t = useT();
  const { isMobile } = useSidebar();
  const who = (
    <>
      <Avatar member={user} size={32} className="rounded-lg ring-0" />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{displayName(user)}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </div>
    </>
  );
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              {who}
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">{who}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
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
              <DropdownMenuItem asChild>
                <Link href="/avatar">
                  <Settings /> {t.nav.settings}
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
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut()}>
              <LogOutIcon /> {t.nav.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
