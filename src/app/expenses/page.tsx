import { ExpensesView } from "@/components/expenses/ExpensesView";
import { track } from "@/lib/activity";
import { loadMembers } from "@/lib/data";
import { loadExpenses } from "@/lib/expenses";
import { requireUser } from "@/lib/session";

export default async function ExpensesPage() {
  const user = await requireUser();
  await track(user.id, "expenses.view");
  const [initial, members] = await Promise.all([loadExpenses(), loadMembers()]);
  return <ExpensesView initial={initial} members={members} />;
}
