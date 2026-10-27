import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Previous / Today / Next button group for date-ranged views. */
export function Pager({
  prev,
  today,
  next,
  prevLabel,
  nextLabel,
  todayLabel,
}: {
  prev: string;
  today: string;
  next: string;
  prevLabel: string;
  nextLabel: string;
  todayLabel: string;
}) {
  const side = "grid h-full w-8 place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground";
  return (
    <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-input bg-card text-sm shadow-xs">
      <Link href={prev} className={side} aria-label={prevLabel}>
        <ChevronLeft className="size-4" />
      </Link>
      <Link href={today} className="h-full border-x border-input px-3 leading-8 font-medium hover:bg-secondary">
        {todayLabel}
      </Link>
      <Link href={next} className={side} aria-label={nextLabel}>
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
