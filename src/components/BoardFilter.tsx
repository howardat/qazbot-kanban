"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3 } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

/** Board picker for cross-board views; writes ?board= and keeps other params. */
export function BoardFilter({ boards, value }: { boards: { id: string; name: string }[]; value: string | null }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => {
        const next = new URLSearchParams(params);
        if (v === ALL) next.delete("board");
        else next.set("board", v);
        router.push(`${pathname}?${next}`);
      }}
    >
      <SelectTrigger aria-label={t.common.board} className="h-8! min-w-44 bg-card shadow-xs">
        <Columns3 className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t.common.allBoards}</SelectItem>
        {boards.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
