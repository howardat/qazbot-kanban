export type Staleness = "fresh" | "dim" | "stale";

const DAY = 86_400_000;

/** How current a worker's status is: updated under a day ago, 1–3 days ago, or older (and anyone idle). */
export function staleness(lastUpdate: string | null, idle: boolean, now: number): Staleness {
  if (idle || !lastUpdate) return "stale";
  const age = now - new Date(lastUpdate).getTime();
  return age < DAY ? "fresh" : age < 3 * DAY ? "dim" : "stale";
}
