import { cn } from "@/lib/utils";

export const TONES = ["sky", "violet", "orange", "green", "rose"] as const;
export type Tone = (typeof TONES)[number];

/**
 * A share drawn as a row of thin ticks: the filled ones in the metric's tone (a light-to-full vertical
 * gradient), the rest in a quiet grey. Reads like a progress bar, but calmer and countable.
 */
export function TickMeter({ value, tone, label, ticks = 32, className }: { value: number; tone: Tone; label: string; ticks?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  // Any non-zero share shows at least one tick.
  const filled = pct > 0 ? Math.max(1, Math.round((pct / 100) * ticks)) : 0;
  return (
    <div className={cn("flex h-7 items-stretch gap-[3px]", className)} role="img" aria-label={label} title={label}>
      {Array.from({ length: ticks }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="flex-1 rounded-full"
          style={{
            background: i < filled ? `linear-gradient(180deg, var(--tone-${tone}-from), var(--tone-${tone}))` : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}
