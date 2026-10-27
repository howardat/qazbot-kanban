/**
 * Completion meter: gradient fill for the done share, then tick marks for what's left.
 * Single series, so no legend; the percentage is labeled on the bar and in text nearby.
 */
export function ProgressMeter({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex h-7 items-stretch gap-1.5" role="img" aria-label={label} title={label}>
      {pct > 0 && (
        <div className="bg-brand-gradient flex items-center justify-end rounded-md px-2" style={{ width: `${Math.max(pct, 8)}%` }}>
          {pct >= 14 && <span className="rounded bg-white/25 px-1 text-[11px] font-semibold text-white">{pct}%</span>}
        </div>
      )}
      {pct < 100 && (
        <>
          <div className="w-0.5 shrink-0 rounded-full bg-brand" aria-hidden />
          <div
            className="flex-1 rounded-sm"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--border) 0 3px, transparent 3px 9px)" }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
