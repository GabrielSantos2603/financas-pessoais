/**
 * Dinheiro SEMPRE em centavos inteiros (number seguro até R$ 90 trilhões).
 * Nunca some/divida valores em reais com ponto flutuante.
 */
export type Cents = number;

export const sumCents = (values: Iterable<Cents>): Cents => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};

/** "1.234,56" / "123456" / "R$ 0,05" → centavos. Só os dígitos importam (máscara estilo caixa eletrônico). */
export function parseCents(input: string): Cents {
  const digits = input.replace(/\D/g, "").slice(0, 13);
  return digits ? Number(digits) : 0;
}

/** Converte um valor decimal digitado/lido (ex.: 477.5, "477,50") em centavos, com arredondamento correto. */
export function reaisToCents(reais: number): Cents {
  return Math.round((reais + Number.EPSILON) * 100);
}

/** Porcentagem de `part` sobre `total` (0 quando total é 0). */
export const percentOf = (part: Cents, total: Cents): number => (total === 0 ? 0 : (part / total) * 100);
