import { gte, sql, sum } from "drizzle-orm";
import { Bot, CalendarRange, Coins, KeyRound, ToggleLeft, Users, Wallet } from "lucide-react";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { PageHeader, Panel, StatTile } from "@/components/atoms";
import { TickMeter } from "@/components/TickMeter";
import { PersonalKeyForm } from "@/components/PersonalKeyForm";
import { TabLink, TabsNav } from "@/components/ui/tabs";
import { monthlyBudgetUsd } from "@/lib/ai/agent";
import { MODEL_TIERS } from "@/lib/ai/models";
import { track } from "@/lib/activity";
import { loadMembers } from "@/lib/data";
import { addDays, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { displayName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { loadFeatureUsage } from "@/lib/workers";

const TZ = process.env.APP_TIMEZONE ?? "Asia/Almaty";
const dayInTz = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const modelLabel = (id: string) => MODEL_TIERS.flatMap((t) => t.models).find((m) => m.id === id)?.label ?? id;

/** Remaining OpenRouter credit for the configured key, or null when there's no key or the call fails. */
async function openRouterBalance() {
  if (!process.env.OPENROUTER_API_KEY) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: { total_credits: number; total_usage: number } };
    return data.total_credits - data.total_usage;
  } catch {
    return null;
  }
}

const WINDOWS = [7, 30, 90] as const;

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requireUser();
  await track(user.id, "usage.view");
  const isAdmin = user.role === "admin";
  const sp = await searchParams;
  const windowDays = WINDOWS.find((d) => String(d) === sp.days) ?? 30;
  const t = await getT();
  const u = t.usage;
  const today = todayISO();
  const since = new Date(Date.now() - 31 * 86_400_000);

  const [rows, [allTime], members, balance] = await Promise.all([
    db.select().from(aiUsage).where(gte(aiUsage.createdAt, since)),
    db.select({ cost: sum(aiUsage.costUsd), n: sql<number>`count(*)::int` }).from(aiUsage),
    loadMembers(),
    openRouterBalance(),
  ]);
  const features = isAdmin ? await loadFeatureUsage(new Date(Date.now() - windowDays * 86_400_000)) : [];
  const unused = features.filter((f) => f.uses === 0).length;
  const budget = monthlyBudgetUsd();
  const byId = new Map(members.map((m) => [m.id, m]));

  const withDay = rows.map((r) => ({ ...r, day: dayInTz(r.createdAt), cost: Number(r.costUsd) }));
  const total = (list: typeof withDay) => list.reduce((s, r) => s + r.cost, 0);
  const monthStart = `${today.slice(0, 7)}-01`;
  const month = withDay.filter((r) => r.day >= monthStart);
  const periods = [
    { label: u.today, list: withDay.filter((r) => r.day === today), tone: "sky" as const },
    { label: u.week, list: withDay.filter((r) => r.day > addDays(today, -7)), tone: "violet" as const },
    { label: u.month, list: month, tone: "orange" as const },
  ];
  const pct = (part: number, whole: number) => (whole ? Math.min(100, Math.round((part / whole) * 100)) : 0);

  const group = (key: (r: (typeof withDay)[number]) => string) => {
    const m = new Map<string, { cost: number; n: number; tokens: number }>();
    for (const r of month) {
      const g = m.get(key(r)) ?? { cost: 0, n: 0, tokens: 0 };
      g.cost += r.cost;
      g.n += 1;
      g.tokens += r.promptTokens + r.completionTokens;
      m.set(key(r), g);
    }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);
  };
  const byModel = group((r) => r.model);
  const byPerson = group((r) => r.profileId ?? "");

  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((d) => ({
    day: d,
    cost: total(withDay.filter((r) => r.day === d)),
  }));
  const dayMax = Math.max(...days.map((d) => d.cost), 0.000001);
  const tokens = new Intl.NumberFormat(t.locale === "ru" ? "ru-RU" : "en-GB", { notation: "compact" });

  return (
    <main>
      <PageHeader title={u.title} description={u.description} />
      <div className="space-y-4 px-4 py-5 md:px-6">
        <Panel icon={<KeyRound />} title={t.settings.keyTitle} className="max-w-2xl">
          <div className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">{t.settings.keyHint}</p>
            <PersonalKeyForm hint={user.openrouterKeyHint} />
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {periods.map((p) => {
            // Today and the week as a share of the month; the month itself against the budget, if any.
            const share = p.list === month ? (budget ? pct(total(month), budget) : null) : pct(total(p.list), total(month));
            return (
              <StatTile
                key={p.label}
                icon={<Coins />}
                title={p.label}
                value={t.fmt.usd(total(p.list))}
                meter={share !== null && <TickMeter tone={p.tone} value={share} label={p.list === month ? u.ofBudget(share) : u.shareOfMonth(share)} />}
              >
                {u.requests(p.list.length)}
              </StatTile>
            );
          })}
          <StatTile icon={<Wallet />} title={u.balance} value={balance === null ? "—" : t.fmt.usd(balance)}>
            {balance === null ? u.balanceUnknown : budget ? u.budget(t.fmt.usd(total(month)), t.fmt.usd(budget)) : u.noBudget}
          </StatTile>
        </div>

        <Panel icon={<CalendarRange />} title={u.daily} action={<span className="text-xs tabular-nums">{u.allTime}: {t.fmt.usd(Number(allTime?.cost ?? 0))}</span>}>
          {/* One bar per day, height relative to the busiest day. Quiet grey bars; the busiest day stands
              out in glossy blue with its amount on a dark tag above it. */}
          <ol className="flex h-44 items-end gap-1 px-4 pt-10 pb-2">
            {days.map((d) => {
              const peak = d.cost > 0 && d.cost === dayMax;
              return (
                <li key={d.day} className="relative flex h-full flex-1 flex-col justify-end" title={`${t.fmt.day(d.day)}: ${t.fmt.usd(d.cost)}`}>
                  {peak && (
                    <span className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-background shadow-sm tabular-nums after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-foreground" style={{ bottom: `calc(${(d.cost / dayMax) * 100}% + 6px)` }} aria-label={u.peak}>
                      {t.fmt.usd(d.cost)}
                    </span>
                  )}
                  <div
                    className={cn("rounded-md", peak ? "bg-bar-highlight" : "bg-bar-rest")}
                    style={{ height: d.cost ? `${Math.max(4, (d.cost / dayMax) * 100)}%` : 3 }}
                  />
                </li>
              );
            })}
          </ol>
          <div className="flex justify-between px-4 pb-3 text-[11px] text-muted-foreground">
            <span>{t.fmt.day(days[0].day)}</span>
            <span>{t.fmt.day(today)}</span>
          </div>
        </Panel>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <Breakdown
            icon={<Bot />}
            title={u.byModel}
            head={[u.model, u.tokens, u.cost]}
            rows={byModel.map(([id, g]) => [modelLabel(id), tokens.format(g.tokens), t.fmt.usd(g.cost)])}
            empty={u.empty}
          />
          <Breakdown
            icon={<Users />}
            title={u.byPerson}
            head={[u.person, u.tokens, u.cost]}
            rows={byPerson.map(([id, g]) => {
              const m = byId.get(id);
              return [m ? displayName(m) : u.removed, tokens.format(g.tokens), t.fmt.usd(g.cost)];
            })}
            empty={u.empty}
          />
        </div>

        {isAdmin && (
          <Panel
            icon={<ToggleLeft />}
            title={u.features}
            action={
              <TabsNav size="sm">
                {WINDOWS.map((d) => (
                  <TabLink key={d} href={`/usage?days=${d}`} scroll={false} active={d === windowDays}>
                    {u.days(d)}
                  </TabLink>
                ))}
              </TabsNav>
            }
          >
            <p className="border-b px-4 py-2 text-xs text-muted-foreground">
              {u.featuresHint} {u.unused(unused)}.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">{u.feature}</th>
                  <th className="px-4 py-2 text-right font-medium">{u.uses}</th>
                  <th className="px-4 py-2 text-right font-medium">{u.people}</th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">{u.lastUsed}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {features.map((f) => (
                  <tr key={f.feature} className={f.uses === 0 ? "text-muted-foreground" : undefined}>
                    <td className="px-4 py-2">
                      {u.featureNames[f.feature]}
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">{f.feature}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{f.uses}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{f.people}</td>
                    <td className="hidden px-4 py-2 text-right sm:table-cell">{f.last ? t.fmt.ago(f.last) : u.never}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Breakdown({
  icon,
  title,
  head,
  rows,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  head: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <Panel icon={icon} title={title}>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {head.map((h, i) => (
                <th key={h} className={i === 0 ? "px-4 py-2 text-left font-medium" : "px-4 py-2 text-right font-medium"}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r[0]}>
                {r.map((c, i) => (
                  <td key={i} className={i === 0 ? "truncate px-4 py-2" : "px-4 py-2 text-right tabular-nums"}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
