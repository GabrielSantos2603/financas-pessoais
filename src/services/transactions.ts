import type { InstallmentGroupRow, Status, Transaction } from "@/types/db";
import { validateDraft, type TxDraft } from "@/domain/draft";
import { toImportPayload, type ImportRow } from "@/domain/import-xlsx";
import { fetchAllPages, ServiceError, unwrap, type Db, type Scope } from "./db";

export async function listTransactions(db: Db, from: string, to: string): Promise<Transaction[]> {
  return fetchAllPages((a, b) =>
    db.from("transactions").select("*").gte("due_date", from).lte("due_date", to)
      .order("due_date").order("created_at").order("id").range(a, b),
  );
}

export async function listInstallmentGroups(db: Db): Promise<InstallmentGroupRow[]> {
  const rows = unwrap(await db.rpc("installment_groups"));
  return rows.map((r) => ({ ...r, focus: r.focus as unknown as Transaction }));
}

export async function setStatus(db: Db, id: string, status: Status, today: string): Promise<void> {
  unwrap(await db.from("transactions").update({ status, settled_at: status === "done" ? today : null }).eq("id", id));
}

export type SaveTarget = { mode: "create" } | { mode: "update"; tx: Transaction; scope: Scope };
export interface SaveContext { householdId: string; today: string }

/** Converte o rascunho do formulário na operação certa do banco. Retorna a mensagem de sucesso. */
export async function saveDraft(db: Db, draft: TxDraft, target: SaveTarget, ctx: SaveContext): Promise<string> {
  const invalid = validateDraft(draft, target.mode);
  if (invalid) throw new ServiceError(invalid);

  const common = {
    p_description: draft.description.trim(), p_amount_cents: draft.amountCents,
    p_person_id: draft.personId, p_category_id: draft.categoryId, p_account_id: draft.accountId,
  };

  if (target.mode === "update") {
    unwrap(await db.rpc("update_transaction", {
      ...common, p_id: target.tx.id, p_scope: target.scope, p_kind: draft.kind, p_due_date: draft.dueDate,
      p_done: draft.done, p_notes: draft.notes, p_today: ctx.today,
    }));
    return "Lançamento atualizado";
  }

  if (draft.repeat === "installments") {
    const { total, current, amountIsTotal } = draft.installments;
    unwrap(await db.rpc("create_installments", {
      ...common, p_kind: draft.kind, p_amount_is_total: amountIsTotal, p_first_due: draft.dueDate,
      p_total: total, p_current: current, p_notes: draft.notes, p_first_done: draft.done, p_today: ctx.today,
    }));
    const n = total - current + 1;
    return `${n} ${n === 1 ? "parcela criada" : "parcelas criadas"}`;
  }

  if (draft.repeat === "monthly") {
    unwrap(await db.rpc("create_recurring", {
      ...common, p_kind: draft.kind, p_day: Number(draft.dueDate.slice(8, 10)),
      p_start_month: `${draft.dueDate.slice(0, 7)}-01`, p_first_done: draft.done, p_today: ctx.today,
    }));
    return "Lançamento fixo criado";
  }

  unwrap(await db.from("transactions").insert({
    household_id: ctx.householdId, kind: draft.kind, description: draft.description.trim(),
    amount_cents: draft.amountCents, due_date: draft.dueDate, status: draft.done ? "done" : "pending",
    settled_at: draft.done ? ctx.today : null, person_id: draft.personId, category_id: draft.categoryId,
    account_id: draft.accountId, notes: draft.notes.trim() || null,
  }));
  return draft.kind === "income" ? "Receita adicionada" : "Despesa adicionada";
}

export async function removeTransaction(db: Db, tx: Transaction, scope: Scope): Promise<number> {
  return unwrap(await db.rpc("delete_transactions", { p_id: tx.id, p_scope: scope }));
}

export interface ImportOutcome { inserted: number; duplicates: number }

export async function importRows(db: Db, rows: readonly ImportRow[]): Promise<ImportOutcome> {
  const res = unwrap(await db.rpc("import_transactions", { p_rows: toImportPayload(rows) }));
  return res as unknown as ImportOutcome;
}
