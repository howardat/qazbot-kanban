import "server-only";

/**
 * Official USD→KZT rate of the National Bank of Kazakhstan for a date (YYYY-MM-DD), from its public rates feed.
 * The feed also answers for weekends and holidays (with the last set rate). Past dates never change, so they're
 * cached for good; today's is re-read hourly. Null when the feed has no rate (e.g. a future date) or is down.
 */
export async function nbkUsdRate(date: string): Promise<number | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-");
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) return null;
  try {
    const res = await fetch(`https://nationalbank.kz/rss/get_rates.cfm?fdate=${d}.${m}.${y}`, {
      next: date < today ? { revalidate: false } : { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const item = xml.match(/<title>USD<\/title>\s*<description>([\d.]+)<\/description>\s*<quant>(\d+)<\/quant>/);
    if (!item) return null;
    const rate = Number(item[1]) / Number(item[2]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/** Rates for several dates at once, as { date: rate }; dates without a rate are left out. */
export async function nbkUsdRates(dates: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(dates)];
  const rates = await Promise.all(unique.map(nbkUsdRate));
  return Object.fromEntries(unique.flatMap((d, i) => (rates[i] ? [[d, rates[i]]] : [])));
}
