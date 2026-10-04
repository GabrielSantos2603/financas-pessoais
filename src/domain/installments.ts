import type { Cents } from "./money";

export interface InstallmentPlan {
  /** valor de cada parcela criada (da parcela `current` até `total`) */
  amounts: Cents[];
  /** total da compra inteira */
  purchaseTotal: Cents;
}

/**
 * Divide em centavos inteiros: as "sobras" de centavo vão para as primeiras parcelas.
 * DEVE ser idêntico a public.create_installments no banco (há teste que compara os dois).
 */
export function planInstallments(opts: {
  amountCents: Cents; amountIsTotal: boolean; total: number; current: number;
}): InstallmentPlan {
  const { amountCents, amountIsTotal, total, current } = opts;
  if (!Number.isInteger(total) || total < 2 || total > 120) throw new RangeError("Número de parcelas inválido");
  if (!Number.isInteger(current) || current < 1 || current > total) throw new RangeError("Parcela atual inválida");

  const purchaseTotal = amountIsTotal ? amountCents : amountCents * total;
  const base = Math.floor(purchaseTotal / total);
  const remainder = purchaseTotal % total;
  const amounts: Cents[] = [];
  for (let k = current; k <= total; k++) amounts.push(base + (k <= remainder ? 1 : 0));
  return { amounts, purchaseTotal };
}
