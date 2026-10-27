"use client";

import { AlertCircle, CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarHue, TAG_DOT } from "@/lib/colors";
import { useT } from "@/components/I18nProvider";
import { dueState, type ISODate } from "@/lib/dates";
import { displayName, type Member, type Tag } from "@/lib/types";

export function Avatar({ member, size = 24, className }: { member: Member; size?: number; className?: string }) {
  const label = displayName(member);
  const initials = label
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      title={label}
      aria-label={label}
      className={cn("avatar inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-2 ring-card", className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38), "--hue": avatarHue(member.email) } as React.CSSProperties}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ members, max = 3, size = 22 }: { members: Member[]; max?: number; size?: number }) {
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <span className="flex -space-x-1.5">
      {shown.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Plane's label pill: grey fill, no border, the label's colour as a small dot. `md` is the peek-panel size. */
export function TagBadge({ tag, size = "sm", className }: { tag: Pick<Tag, "name" | "color">; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-40 items-center gap-1.5 rounded-md bg-muted font-medium leading-none text-muted-foreground",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2 text-xs",
        className,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", TAG_DOT[tag.color])} aria-hidden />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

// Property chips, as on Plane's cards: neutral hairline chip, colored only when it needs attention.
const DUE_STYLE = {
  overdue: "border-destructive/40 text-destructive",
  today: "border-warning/40 text-warning",
  soon: "border-warning/40 text-warning",
  later: "border-border-strong text-muted-foreground",
  done: "border-border-strong text-muted-foreground line-through",
  none: "",
} as const;

export function DueBadge({
  start,
  due,
  today,
  done,
}: {
  start: ISODate | null;
  due: ISODate | null;
  today: ISODate;
  done: boolean;
}) {
  const t = useT();
  const state = dueState(due, today, done);
  if (state === "none") {
    return start ? (
      <span className="inline-flex h-5 items-center gap-1 rounded-sm border-[0.5px] border-border-strong px-1.5 text-[11px] font-medium text-muted-foreground">
        <CalendarDays className="size-3" /> {t.due.from(start)}
      </span>
    ) : null;
  }
  const Icon = state === "overdue" ? AlertCircle : state === "later" || state === "done" ? CalendarDays : Clock;
  const text = state === "later" || state === "done" ? t.fmt.day(due!) : t.due.relative(due!, today);
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-sm border-[0.5px] px-1.5 text-[11px] font-medium", DUE_STYLE[state])}>
      <Icon className="size-3" />
      {start && (state === "later" || state === "done") && <span className="font-normal">{t.fmt.day(start)} –</span>}
      {text}
    </span>
  );
}

/** Plane-style section card: header row with a hairline divider over the body. */
export function Panel({
  icon,
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border bg-card shadow-xs", className)}>
      <header className="flex h-10 items-center gap-2 border-b px-4 text-sm text-muted-foreground">
        {icon && <span className="[&_svg]:size-4">{icon}</span>}
        <h2 className="font-medium text-foreground">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Page header band: title, description and page actions over a hairline divider. */
/**
 * A headline number as a card in a card: the label sits on a grey tray, the number and its context on a
 * white card inside it, with an optional tick meter in the metric's tone.
 */
export function StatTile({
  icon,
  title,
  value,
  children,
  meter,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  value: React.ReactNode;
  children?: React.ReactNode;
  meter?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border bg-muted/60 p-1">
      <header className="flex h-8 items-center gap-2 px-2.5 text-sm text-muted-foreground [&_svg]:size-4">
        {icon}
        <h2 className="truncate font-medium text-foreground">{title}</h2>
      </header>
      <div className="flex-1 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          {children && <div className="truncate text-sm text-muted-foreground">{children}</div>}
        </div>
        {meter}
      </div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b">
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 md:px-6">
        <div className="mr-auto min-w-0">
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
