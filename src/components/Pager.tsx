import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Previous / Today / Next button group for date-ranged views: links, or buttons when given handlers. */
export function Pager({
  prev,
  today,
  next,
  prevLabel,
  nextLabel,
  todayLabel,
}: {
  prev: string | (() => void);
  today: string | (() => void);
  next: string | (() => void);
  prevLabel: string;
  nextLabel: string;
  todayLabel: string;
}) {
  const side = "grid h-full w-8 cursor-pointer place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground";
  const item = (to: string | (() => void), className: string, children: React.ReactNode, label?: string) =>
    typeof to === "string" ? (
      <Link href={to} className={className} aria-label={label}>
        {children}
      </Link>
    ) : (
      <button type="button" onClick={to} className={className} aria-label={label}>
        {children}
      </button>
    );
  return (
    <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-input bg-card text-sm shadow-xs">
      {item(prev, side, <ChevronLeft className="size-4" />, prevLabel)}
      {item(today, "h-full cursor-pointer border-x border-input px-3 leading-8 font-medium hover:bg-secondary", todayLabel)}
      {item(next, side, <ChevronRight className="size-4" />, nextLabel)}
    </div>
  );
}
