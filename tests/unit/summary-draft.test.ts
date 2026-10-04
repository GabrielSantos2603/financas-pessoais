import { describe, expect, it } from "vitest";
import { summarize, summaryFromRow, sumSummaries } from "@/domain/summary";
import { isValidIsoDate, validateDraft, type TxDraft } from "@/domain/draft";
import type { PeriodSummaryRow, Transaction } from "@/types/db";

const tx = (over: Partial<Transaction>): Transaction => ({
  id: "x", household_id: "h", kind: "expense", description: "d", amount_cents: 1000, due_date: "2026-10-01",
  status: "pending", settled_at: null, person_id: null, category_id: null, account_id: null,
  installment_group: null, installment_number: null, installment_total: null, recurring_id: null,
  notes: null, created_by: null, created_at: "2026-10-01T00:00:00Z", ...over,
});

describe("summarize", () => {
  const savings = new Set(["save"]);
  const list = [
    tx({ kind: "income", amount_cents: 500000, status: "done" }),
    tx({ kind: "income", amount_cents: 200000 }),
    tx({ amount_cents: 80000, status: "done", category_id: "food" }),
    tx({ amount_cents: 30000, category_id: "food" }),
    tx({ amount_cents: 100000, status: "done", category_id: "save" }), // guardado
    tx({ amount_cents: 5000 }),                                         // sem categoria = despesa
  ];

  it("separa receita, despesa e guardado", () => {
    expect(summarize(list, savings)).toEqual({
      income: 700000, incomeDone: 500000, incomePending: 200000,
      expense: 115000, expenseDone: 80000, expensePending: 35000,
      saved: 100000, savedDone: 100000,
      balance: 700000 - 115000 - 100000,
      cash: 500000 - 80000 - 100000,
    });
  });

  it("lista vazia dá tudo zero", () => {
    expect(Object.values(summarize([], savings)).every((v) => v === 0)).toBe(true);
  });

  it("summaryFromRow produz o mesmo resumo que summarize", () => {
    const row: PeriodSummaryRow = {
      month: "2026-10-01", income_cents: 700000, income_done_cents: 500000,
      expense_cents: 115000, expense_done_cents: 80000, saved_cents: 100000, saved_done_cents: 100000,
    };
    expect(summaryFromRow(row)).toEqual(summarize(list, savings));
  });

  it("sumSummaries soma os meses e recalcula derivados", () => {
    const a = summarize(list, savings);
    const total = sumSummaries([a, a]);
    expect(total.income).toBe(a.income * 2);
    expect(total.balance).toBe(a.balance * 2);
    expect(total.cash).toBe(a.cash * 2);
  });
});

const draft = (over: Partial<TxDraft> = {}): TxDraft => ({
  kind: "expense", description: "Mercado", amountCents: 1000, dueDate: "2026-10-05", done: false,
  personId: null, categoryId: null, accountId: null, notes: "", repeat: "none",
  installments: { total: 2, current: 1, amountIsTotal: false }, ...over,
});

describe("validateDraft", () => {
  it("aceita um rascunho válido", () => expect(validateDraft(draft(), "create")).toBeNull());
  it("exige descrição", () => expect(validateDraft(draft({ description: "   " }), "create")).toMatch(/descrição/i));
  it("rejeita valor negativo, fracionado ou gigante", () => {
    expect(validateDraft(draft({ amountCents: -1 }), "create")).toMatch(/valor/i);
    expect(validateDraft(draft({ amountCents: 1.5 }), "create")).toMatch(/valor/i);
    expect(validateDraft(draft({ amountCents: 1e12 }), "create")).toMatch(/alto/i);
  });
  it("valida a data de calendário", () => {
    expect(validateDraft(draft({ dueDate: "2026-02-30" }), "create")).toMatch(/data/i);
    expect(validateDraft(draft({ dueDate: "" }), "create")).toMatch(/data/i);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2027-02-29")).toBe(false);
  });
  it("valida parcelas só na criação", () => {
    const bad = draft({ repeat: "installments", installments: { total: 1, current: 1, amountIsTotal: false } });
    expect(validateDraft(bad, "create")).toMatch(/parcelas/i);
    expect(validateDraft(bad, "update")).toBeNull();
    expect(validateDraft(draft({ repeat: "installments", installments: { total: 12, current: 13, amountIsTotal: false } }), "create")).toMatch(/atual/i);
    expect(validateDraft(draft({ amountCents: 5, repeat: "installments", installments: { total: 10, current: 1, amountIsTotal: true } }), "create")).toMatch(/pequeno/i);
  });
  it("limita observação", () => expect(validateDraft(draft({ notes: "x".repeat(1001) }), "create")).toMatch(/observação/i));
});
