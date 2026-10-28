import { ExpensesView } from "@/components/expenses/ExpensesView";
import { requireUser } from "@/lib/session";

export default async function ExpensesPage() {
  await requireUser();
  return <ExpensesView />;
}
