// Dates are plain "YYYY-MM-DD" strings end to end (Postgres `date`), so no time-zone drift.
// "Today" is computed in the team's zone (APP_TIMEZONE, default Asia/Almaty) on the server and passed down.

export type ISODate = string;

const DAY = 86_400_000;

export function todayISO(timeZone = process.env.APP_TIMEZONE ?? "Asia/Almaty"): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

const toUTC = (d: ISODate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromUTC = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: ISODate, n: number) => fromUTC(toUTC(d) + n * DAY);
export const diffDays = (a: ISODate, b: ISODate) => Math.round((toUTC(a) - toUTC(b)) / DAY);
/** 0 = Monday … 6 = Sunday */
export const weekday = (d: ISODate) => (new Date(toUTC(d)).getUTCDay() + 6) % 7;
export const startOfWeek = (d: ISODate) => addDays(d, -weekday(d));
export const monthOf = (d: ISODate) => d.slice(0, 7);
export const isValidMonth = (m: string | undefined): m is string => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const isValidDate = (d: string | undefined): d is string =>
  !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && fromUTC(toUTC(d)) === d;

export function shiftMonth(month: string, n: number) {
  const y = +month.slice(0, 4);
  const m = +month.slice(5, 7) - 1 + n;
  return fromUTC(Date.UTC(y, m, 1)).slice(0, 7);
}

/** 6×7 grid of dates covering the month, weeks starting Monday. */
export function monthGrid(month: string): ISODate[] {
  const first = startOfWeek(`${month}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Date (and money) formatters for one language (a BCP 47 tag such as "en-GB" or "ru-RU"). Dates are UTC days. */
export function makeFormatters(tag: string) {
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: "UTC", ...opts });
  const dayMonth = fmt({ day: "numeric", month: "short" });
  const dayMonthYear = fmt({ day: "numeric", month: "short", year: "numeric" });
  const monthYear = fmt({ month: "long", year: "numeric" });
  const monthShort = fmt({ month: "short" });
  const weekdayShort = fmt({ weekday: "short" });
  const longDay = fmt({ weekday: "long", day: "numeric", month: "long" });
  const money = new Intl.NumberFormat(tag, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const smallMoney = new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumSignificantDigits: 2 });
  const rel = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  const stamp = new Intl.DateTimeFormat(tag, {
    timeZone: process.env.APP_TIMEZONE ?? "Asia/Almaty",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return {
    /** "24 Oct" */
    day: (d: ISODate) => dayMonth.format(toUTC(d)),
    /** "24 Oct 2026" */
    dayYear: (d: ISODate) => dayMonthYear.format(toUTC(d)),
    /** "October 2026", from "YYYY-MM" */
    month: (month: string) => cap(monthYear.format(toUTC(`${month}-01`))),
    /** "Oct" */
    monthShort: (d: ISODate) => monthShort.format(toUTC(d)),
    /** "Sat" */
    weekday: (d: ISODate) => weekdayShort.format(toUTC(d)),
    /** "Saturday 24 October" */
    long: (d: ISODate) => cap(longDay.format(toUTC(d))),
    /** "$1.25"; amounts under a cent keep two significant digits ("$0.0042") so they don't read as zero. */
    usd: (n: number) => (n > 0 && n < 0.01 ? smallMoney.format(n) : money.format(n)),
    /** "5 minutes ago", "yesterday": how long before `now` an instant was. */
    ago: (at: Date | string, now = Date.now()) => {
      const sec = Math.round((new Date(at).getTime() - now) / 1000);
      const abs = Math.abs(sec);
      if (abs < 60) return rel.format(0, "second");
      if (abs < 3600) return rel.format(Math.round(sec / 60), "minute");
      if (abs < 86_400) return rel.format(Math.round(sec / 3600), "hour");
      if (abs < 30 * 86_400) return rel.format(Math.round(sec / 86_400), "day");
      if (abs < 365 * 86_400) return rel.format(Math.round(sec / (30 * 86_400)), "month");
      return rel.format(Math.round(sec / (365 * 86_400)), "year");
    },
    /** "27 Oct 2026, 14:05" in the app time zone */
    stamp: (at: Date | string) => stamp.format(new Date(at)),
  };
}
export type Formatters = ReturnType<typeof makeFormatters>;

export type DueState = "none" | "done" | "overdue" | "today" | "soon" | "later";

export function dueState(due: ISODate | null, today: ISODate, done: boolean): DueState {
  if (!due) return "none";
  if (done) return "done";
  const d = diffDays(due, today);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 3) return "soon";
  return "later";
}
