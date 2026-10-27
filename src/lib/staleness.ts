export type Staleness = "fresh" | "dim" | "stale";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Age at which a status counts as out of date: the age ring is full and red from here. */
export const STALE_AFTER = 2 * DAY;
/** Under this age a status counts as fresh (green). */
export const FRESH_FOR = DAY;

/** How current a worker's status is: updated under a day ago, 1–2 days ago, or older (and anyone idle). */
export function staleness(lastUpdate: string | null, idle: boolean, now: number): Staleness {
  if (idle || !lastUpdate) return "stale";
  const age = now - new Date(lastUpdate).getTime();
  return age < FRESH_FOR ? "fresh" : age < STALE_AFTER ? "dim" : "stale";
}

/** Time since the last update in milliseconds, or null when there has never been one. */
export const ageOf = (lastUpdate: string | null, now: number) => (lastUpdate ? Math.max(0, now - new Date(lastUpdate).getTime()) : null);

/** Whether someone hasn't updated their status for a long time (or ever). */
export const isOutdated = (lastUpdate: string | null, now: number) => (ageOf(lastUpdate, now) ?? Infinity) >= STALE_AFTER;

/** The age as one short number and unit, for the age ring: 45 m, 5 h, 3 d. */
export function shortAge(age: number): { n: number; unit: "m" | "h" | "d" } {
  if (age < HOUR) return { n: Math.max(1, Math.floor(age / MINUTE)), unit: "m" };
  if (age < DAY) return { n: Math.floor(age / HOUR), unit: "h" };
  return { n: Math.floor(age / DAY), unit: "d" };
}
