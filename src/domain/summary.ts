import type { Category, PeriodSummaryRow, Transaction } from "@/types/db";
import { sumCents, type Cents } from "./money";

/** Todos os valores em centavos. */
export interface Summary {
  income: Cents; incomeDone: Cents; incomePending: Cents;
  expense: Cents; expenseDone: Cents; expensePending: Cents; // despesa SEM "guardar"
  saved: Cents; savedDone: Cents;
  /** sobra prevista = receitas − despesas − guardado */
  balance: Cents;
  /** em caixa = recebido − pago (inclui o que foi guardado) */
  cash: Cents;
}

const finish = (s: Omit<Summary, "incomePending" | "expensePending" | "balance" | "cash">): Summary => ({
  ...s,
  incomePending: s.income - s.incomeDone,
  expensePending: s.expense - s.expenseDone,
  balance: s.income - s.expense - s.saved,
  cash: s.incomeDone - s.expenseDone - s.savedDone,
});

/** Resumo calculado no navegador sobre uma lista já carregada (ex.: lista filtrada). */
export function summarize(txs: readonly Transaction[], savingsIds: ReadonlySet<string>): Summary {
  const sel = (pred: (t: Transaction) => boolean) => sumCents(txs.filter(pred).map((t) => t.amount_cents));
  const isSaved = (t: Transaction) => t.kind === "expense" && !!t.category_id && savingsIds.has(t.category_id);
  const isSpend = (t: Transaction) => t.kind === "expense" && !isSaved(t);
  const done = (t: Transaction) => t.status === "done";
  return finish({
    income: sel((t) => t.kind === "income"),
    incomeDone: sel((t) => t.kind === "income" && done(t)),
    expense: sel(isSpend),
    expenseDone: sel((t) => isSpend(t) && done(t)),
    saved: sel(isSaved),
    savedDone: sel((t) => isSaved(t) && done(t)),
  });
}

/** Mesmo resumo, a partir da agregação feita no banco (`period_summary`). */
export const summaryFromRow = (r: PeriodSummaryRow): Summary =>
  finish({
    income: r.income_cents, incomeDone: r.income_done_cents,
    expense: r.expense_cents, expenseDone: r.expense_done_cents,
    saved: r.saved_cents, savedDone: r.saved_done_cents,
  });

export const sumSummaries = (list: readonly Summary[]): Summary =>
  finish({
    income: sumCents(list.map((s) => s.income)), incomeDone: sumCents(list.map((s) => s.incomeDone)),
    expense: sumCents(list.map((s) => s.expense)), expenseDone: sumCents(list.map((s) => s.expenseDone)),
    saved: sumCents(list.map((s) => s.saved)), savedDone: sumCents(list.map((s) => s.savedDone)),
  });

export const savingsSet = (cats: readonly Category[]) => new Set(cats.filter((c) => c.is_savings).map((c) => c.id));
