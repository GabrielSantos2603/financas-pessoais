import type { Kind, RecurringRule } from "@/types/db";
import { unwrap, type Db } from "./db";

export async function listRules(db: Db): Promise<RecurringRule[]> {
  return unwrap(await db.from("recurring_rules").select("*").order("day_of_month").order("description"));
}

export interface RuleCreate {
  kind: Kind; description: string; amountCents: number; day: number; startMonth: string;
  personId: string | null; categoryId: string | null; accountId: string | null; today: string;
}

/** Cria a regra e já gera o lançamento do mês inicial (atômico no banco). */
export async function createRule(db: Db, r: RuleCreate): Promise<string> {
  return unwrap(await db.rpc("create_recurring", {
    p_kind: r.kind, p_description: r.description, p_amount_cents: r.amountCents, p_day: r.day,
    p_start_month: r.startMonth, p_person_id: r.personId, p_category_id: r.categoryId, p_account_id: r.accountId,
    p_first_done: false, p_today: r.today,
  }));
}

export interface RuleEdit {
  id: string; description: string; amountCents: number; day: number; personId: string | null;
  categoryId: string | null; accountId: string | null; active: boolean; fromMonth: string;
}

/** Edita a regra e propaga aos meses futuros pendentes (atômico no banco). Retorna quantos lançamentos mudaram. */
export async function updateRule(db: Db, r: RuleEdit): Promise<number> {
  return unwrap(await db.rpc("update_recurring", {
    p_id: r.id, p_description: r.description, p_amount_cents: r.amountCents, p_day: r.day,
    p_person_id: r.personId, p_category_id: r.categoryId, p_account_id: r.accountId, p_active: r.active, p_from_month: r.fromMonth,
  }));
}

export async function deleteRule(db: Db, id: string, from: string): Promise<number> {
  return unwrap(await db.rpc("delete_recurring", { p_id: id, p_from: from }));
}

/** Gera os fixos de um mês (idempotente). Retorna quantos lançamentos foram criados. */
export async function materializeMonth(db: Db, monthFirstDay: string): Promise<number> {
  return unwrap(await db.rpc("materialize_recurring", { p_month: monthFirstDay }));
}
