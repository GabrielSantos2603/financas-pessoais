import type { Budget } from "@/types/db";
import { unwrap, type Db } from "./db";

export async function listBudgets(db: Db, monthFirstDay: string): Promise<Budget[]> {
  return unwrap(await db.from("budgets").select("*").eq("month", monthFirstDay));
}

/** Define o limite da categoria no mês; valor 0 remove o limite. */
export async function setBudget(db: Db, householdId: string, categoryId: string, monthFirstDay: string, amountCents: number) {
  if (amountCents > 0) {
    unwrap(await db.from("budgets").upsert(
      { household_id: householdId, category_id: categoryId, month: monthFirstDay, amount_cents: amountCents },
      { onConflict: "category_id,month" },
    ));
  } else {
    unwrap(await db.from("budgets").delete().eq("category_id", categoryId).eq("month", monthFirstDay));
  }
}

export async function copyBudgets(db: Db, fromMonthFirstDay: string, toMonthFirstDay: string): Promise<number> {
  return unwrap(await db.rpc("copy_budgets", { p_from: fromMonthFirstDay, p_to: toMonthFirstDay }));
}
