"use client";

// The amount input with its currency: a big number and a ₸ / $ switch, used by the add modal and the side peek.
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CURRENCY_SIGN, parseAmount, type Currency } from "./data";

const CURRENCIES: Currency[] = ["KZT", "USD"];

/** Groups the integer part for reading ("1 250 000" in ₸, "1,250.5" in $) and keeps any typed decimals. */
function display(text: string, c: Currency) {
  if (!text) return "";
  const [int, dec] = text.split(".");
  const grouped = new Intl.NumberFormat(c === "USD" ? "en-US" : "ru-RU").format(Number(int || 0));
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}

export function AmountField({
  amount,
  currency,
  onChange,
  autoFocus,
}: {
  amount: number;
  currency: Currency;
  onChange: (amount: number, currency: Currency) => void;
  autoFocus?: boolean;
}) {
  // Typed text is kept separately so "12." or "12.5" survive while typing a dollar amount.
  const [text, setText] = useState(amount ? String(amount) : "");
  const setCurrency = (c: Currency) => {
    const next = parseAmount(text, c); // switching to ₸ drops cents
    setText(next);
    onChange(Number(next) || 0, c);
  };

  return (
    <div className="rounded-lg border bg-muted/40 px-4 pt-3 pb-2 transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Amount</span>
        <div className="flex rounded-md border bg-card p-0.5 text-xs" role="radiogroup" aria-label="Currency">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={currency === c}
              onClick={() => setCurrency(c)}
              className={cn("h-6 rounded px-2 font-medium text-muted-foreground", currency === c && "bg-foreground text-background")}
            >
              {CURRENCY_SIGN[c]} {c}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-baseline gap-2">
        {currency === "USD" && <span className="text-3xl font-semibold text-muted-foreground">$</span>}
        <input
          autoFocus={autoFocus}
          inputMode="decimal"
          aria-label="Amount"
          value={display(text, currency)}
          onChange={(e) => {
            const next = parseAmount(e.target.value, currency);
            setText(next);
            onChange(Number(next) || 0, currency);
          }}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/50"
        />
        {currency === "KZT" && <span className="text-xl font-medium text-muted-foreground">₸</span>}
      </label>
    </div>
  );
}
