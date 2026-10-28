// PROTOTYPE — throwaway. Three variants of an Expenses page, switchable via `?variant=A|B|C`, on throwaway
// route /prototype/expenses. In-memory state only, mock data, no DB. Delete once a variant is picked.
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { ExpensesPrototype } from "./ExpensesPrototype";

export default async function ExpensesPrototypePage() {
  await requireUser();
  return (
    <Suspense>
      <ExpensesPrototype />
    </Suspense>
  );
}
