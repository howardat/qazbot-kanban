"use client";

// The amount input: a big tenge number, grouped as you type. Used by the add modal and the side peek.
import { kzt } from "./data";

export function AmountField({ amount, onChange, autoFocus }: { amount: number; onChange: (amount: number) => void; autoFocus?: boolean }) {
  return (
    <label className="block rounded-lg border bg-muted/40 px-4 pt-3 pb-2 transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
      <span className="text-xs font-medium text-muted-foreground">Amount</span>
      <span className="flex items-baseline gap-2">
        <input
          autoFocus={autoFocus}
          inputMode="numeric"
          value={amount ? kzt(amount).replace(" ₸", "") : ""}
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/50"
        />
        <span className="text-xl font-medium text-muted-foreground">₸</span>
      </span>
    </label>
  );
}
