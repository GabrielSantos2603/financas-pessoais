/**
 * Chaves do React Query. Tudo que depende de lançamentos fica sob o prefixo ["tx", casa],
 * então invalidar esse prefixo atualiza listas, resumos, rankings e parcelas de uma vez.
 */
export const keys = {
  refs: (h: string) => ["refs", h] as const,
  members: (h: string) => ["members", h] as const,
  recurring: (h: string) => ["recurring", h] as const,
  budgets: (h: string, month: string) => ["budgets", h, month] as const,
  budgetsAll: (h: string) => ["budgets", h] as const,

  tx: (h: string) => ["tx", h] as const,
  txLists: (h: string) => ["tx", h, "range"] as const,
  txRange: (h: string, from: string, to: string) => ["tx", h, "range", from, to] as const,
  summary: (h: string, from: string, to: string) => ["tx", h, "summary", from, to] as const,
  categoryTotals: (h: string, from: string, to: string) => ["tx", h, "categories", from, to] as const,
  personTotals: (h: string, from: string, to: string) => ["tx", h, "people", from, to] as const,
  installments: (h: string) => ["tx", h, "installments"] as const,
};
