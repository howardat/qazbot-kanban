"use client";

import { useT } from "@/components/I18nProvider";
import { PersonIcon } from "@/components/PersonIcon";
import { AGE_COLORS } from "@/components/office/palette";
import { ageOf, FRESH_FOR, shortAge, STALE_AFTER } from "@/lib/staleness";
import type { Member } from "@/lib/types";

/** Ring colour for a status age: green under a day, amber up to 2 days, red after, grey when never. */
export function ageColor(age: number | null) {
  if (age === null) return AGE_COLORS.never;
  return age < FRESH_FOR ? AGE_COLORS.fresh : age < STALE_AFTER ? AGE_COLORS.dim : AGE_COLORS.stale;
}

/**
 * A person's avatar inside a timer ring: the ring fills up over 2 days since their last status update
 * and turns from green to amber to red, so "how long ago" reads at a glance.
 */
export function AgeAvatar({ member, lastUpdate, now, size = 22 }: { member: Member; lastUpdate: string | null; now: number; size?: number }) {
  const age = ageOf(lastUpdate, now);
  const stroke = 2.5;
  const box = size + stroke * 2 + 2;
  const r = (box - stroke) / 2;
  const length = 2 * Math.PI * r;
  const filled = age === null ? 1 : Math.min(1, age / STALE_AFTER);
  const color = ageColor(age);
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: box, height: box }}>
      <svg aria-hidden width={box} height={box} className="absolute inset-0 -rotate-90">
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled * length} ${length}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <PersonIcon member={member} size={size} />
    </span>
  );
}

/** "5h", "3d", or "—": the same age in words short enough for a pill. */
export function AgeText({ lastUpdate, now, className }: { lastUpdate: string | null; now: number; className?: string }) {
  const w = useT().workers;
  const age = ageOf(lastUpdate, now);
  if (age === null) return <span className={className}>{w.nothing}</span>;
  const { n, unit } = shortAge(age);
  return (
    <span className={className} style={{ color: ageColor(age) }}>
      {w.ageShort[unit](n)}
    </span>
  );
}
