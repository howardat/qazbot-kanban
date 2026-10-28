import { ExpensesView } from "@/components/expenses/ExpensesView";
import { SEED_EXPENSES } from "@/components/expenses/data";
import { nbkUsdRates } from "@/lib/nbk";
import { requireUser } from "@/lib/session";

export default async function ExpensesPage() {
  await requireUser();
  // National Bank rates for every dollar expense's date, plus today's as the fallback for dates without one.
  const today = new Date().toISOString().slice(0, 10);
  const rates = await nbkUsdRates([today, ...SEED_EXPENSES.filter((e) => e.currency === "USD").map((e) => e.date)]);
  const expenses = SEED_EXPENSES.map((e) => (e.currency === "USD" ? { ...e, rate: rates[e.date] ?? null } : e));
  return <ExpensesView initial={expenses} todayRate={rates[today] ?? null} />;
}
