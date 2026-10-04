import type { Kind } from "@/types/db";
import type { Cents } from "./money";

export type Repeat = "none" | "installments" | "monthly";

/** O que o formulário de lançamento produz. É convertido em chamadas ao banco por services/transactions. */
export interface TxDraft {
  kind: Kind;
  description: string;
  amountCents: Cents;
  dueDate: string; // yyyy-mm-dd
  done: boolean;
  personId: string | null;
  categoryId: string | null;
  accountId: string | null;
  notes: string;
  repeat: Repeat;
  installments: { total: number; current: number; amountIsTotal: boolean };
}

export const MAX_AMOUNT_CENTS = 99_999_999_999; // R$ 999.999.999,99

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Retorna a mensagem de erro (em português) ou null se o rascunho é válido. */
export function validateDraft(d: TxDraft, mode: "create" | "update"): string | null {
  if (!d.description.trim()) return "Informe uma descrição.";
  if (d.description.trim().length > 200) return "A descrição pode ter no máximo 200 caracteres.";
  if (!Number.isInteger(d.amountCents) || d.amountCents < 0) return "Valor inválido.";
  if (d.amountCents > MAX_AMOUNT_CENTS) return "Valor alto demais.";
  if (!isValidIsoDate(d.dueDate)) return "Informe uma data válida.";
  if (d.notes.length > 1000) return "A observação pode ter no máximo 1000 caracteres.";
  if (mode === "create" && d.repeat === "installments") {
    const { total, current } = d.installments;
    if (!Number.isInteger(total) || total < 2 || total > 120) return "O número de parcelas deve ficar entre 2 e 120.";
    if (!Number.isInteger(current) || current < 1 || current > total) return "A parcela atual deve estar entre 1 e o total.";
    if (d.amountCents < total) return "O valor é pequeno demais para esse número de parcelas.";
  }
  return null;
}
