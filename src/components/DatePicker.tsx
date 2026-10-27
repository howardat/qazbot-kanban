"use client";

import { useState } from "react";
import { enGB, ru } from "react-day-picker/locale";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/components/I18nProvider";
import { cn } from "@/lib/utils";

const toDate = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Popover calendar over an ISO "YYYY-MM-DD" value; empty string means no date. */
export function DatePicker({
  value,
  onChange,
  placeholder,
  label,
  accent,
  ghost,
  invalid,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder: string;
  label: string;
  accent?: boolean;
  /** Borderless, for property rows (Plane's peek panel). */
  ghost?: boolean;
  invalid?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={ghost ? "ghost" : "outline"}
            aria-label={label}
            aria-invalid={invalid || undefined}
            className={cn(
              ghost ? "h-8 flex-1 justify-start rounded-md px-2 font-normal aria-invalid:text-destructive" : "h-9 flex-1 justify-start rounded-xl px-3 font-normal",
              !value && "text-muted-foreground",
              accent && value && "border-brand/40 bg-brand-soft",
            )}
          >
            <CalendarDays className="text-muted-foreground" />
            {value ? t.fmt.dayYear(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-2xl p-0" align="start">
          <Calendar
            mode="single"
            locale={t.locale === "ru" ? ru : enGB}
            weekStartsOn={1}
            selected={value ? toDate(value) : undefined}
            defaultMonth={value ? toDate(value) : undefined}
            onSelect={(d) => {
              onChange(d ? toISO(d) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon-sm" onClick={() => onChange("")} aria-label={t.editor.clear(label)}>
          <X />
        </Button>
      )}
    </div>
  );
}
