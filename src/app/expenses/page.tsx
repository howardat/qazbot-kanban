import { ExpensesView } from "@/components/expenses/ExpensesView";
import { track } from "@/lib/activity";
import { loadExpenses } from "@/lib/expenses";
import { requireUser } from "@/lib/session";

export default async function ExpensesPage() {
  const user = await requireUser();
  await track(user.id, "expenses.view");
  return <ExpensesView initial={await loadExpenses()} />;
}
