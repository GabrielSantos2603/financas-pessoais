import type { CategoryTotalRow, PeriodSummaryRow, PersonTotalRow } from "@/types/db";
import { unwrap, type Db } from "./db";

/** Uma linha por mês entre `from` e `to` (meses vazios vêm zerados). Agregado no banco. */
export async function periodSummary(db: Db, from: string, to: string): Promise<PeriodSummaryRow[]> {
  return unwrap(await db.rpc("period_summary", { p_from: from, p_to: to }));
}

export async function categoryTotals(db: Db, from: string, to: string): Promise<CategoryTotalRow[]> {
  return unwrap(await db.rpc("category_totals", { p_from: from, p_to: to }));
}

export async function personTotals(db: Db, from: string, to: string): Promise<PersonTotalRow[]> {
  return unwrap(await db.rpc("person_totals", { p_from: from, p_to: to }));
}
