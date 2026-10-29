import { expect, test } from "vitest";
import { makeFormatters } from "@/lib/dates";
// The formatters spell names out so server and every browser print the same date; they must still
// read exactly as Node's (and Chromium's) Intl does, which the server used before.
test("date formatters read like Node's Intl, in English and Russian", () => {
  for (const tag of ["en-GB", "ru-RU"]) {
    const f = makeFormatters(tag);
    const I = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: "UTC", ...o });
    for (let m = 0; m < 12; m++) for (const d of [1, 7, 28]) {
      const iso = `2026-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const ms = Date.UTC(2026, m, d);
      expect(f.day(iso)).toBe(I({ day: "numeric", month: "short" }).format(ms));
      expect(f.dayYear(iso)).toBe(I({ day: "numeric", month: "short", year: "numeric" }).format(ms));
      expect(f.monthShort(iso)).toBe(I({ month: "short" }).format(ms));
      expect(f.weekday(iso)).toBe(I({ weekday: "short" }).format(ms));
      const long = I({ weekday: "long", day: "numeric", month: "long" }).format(ms);
      expect(f.long(iso)).toBe(long.charAt(0).toUpperCase() + long.slice(1));
      const my = I({ month: "long", year: "numeric" }).format(ms);
      expect(f.month(iso.slice(0, 7))).toBe(my.charAt(0).toUpperCase() + my.slice(1));
    }
  }
});
