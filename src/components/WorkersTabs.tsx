import Link from "next/link";
import { Box, Table2 } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/** Switch between the 3D office and the team dashboard. `dark` sits on the office's dark backdrop. */
export async function WorkersTabs({ active, dark }: { active: "office" | "team"; dark?: boolean }) {
  const t = await getT();
  const tabs = [
    { key: "office", href: "/workers", label: t.workers.tabs.office, Icon: Box },
    { key: "team", href: "/workers/team", label: t.workers.tabs.team, Icon: Table2 },
  ] as const;
  return (
    <nav
      aria-label={t.workers.title}
      className={cn("inline-flex h-9 items-center gap-0.5 rounded-lg p-0.5 text-sm", dark ? "bg-[#24201c]/90 shadow-lg backdrop-blur-sm" : "bg-muted")}
    >
      {tabs.map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded-md px-3 font-medium transition-colors [&_svg]:size-4",
            dark
              ? key === active
                ? "bg-[#f1ebe1] text-[#24201c]"
                : "text-[#f1ebe1]/80 hover:text-[#f1ebe1]"
              : key === active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon /> {label}
        </Link>
      ))}
    </nav>
  );
}
