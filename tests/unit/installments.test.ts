import { describe, expect, it } from "vitest";
import { planInstallments } from "@/domain/installments";
import { sumCents } from "@/domain/money";

// PRNG determinístico para testes de propriedade reproduzíveis
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("planInstallments", () => {
  it("valor total dividido: sobras de centavo vão para as primeiras parcelas", () => {
    const p = planInstallments({ amountCents: 100000, amountIsTotal: true, total: 3, current: 1 });
    expect(p.amounts).toEqual([33334, 33333, 33333]);
    expect(p.purchaseTotal).toBe(100000);
  });

  it("valor da parcela: multiplica pelo total", () => {
    const p = planInstallments({ amountCents: 47700, amountIsTotal: false, total: 10, current: 8 });
    expect(p.amounts).toEqual([47700, 47700, 47700]); // parcelas 8, 9 e 10
    expect(p.purchaseTotal).toBe(477000);
  });

  it("começar numa parcela intermediária usa a mesma distribuição da compra inteira", () => {
    const whole = planInstallments({ amountCents: 100, amountIsTotal: true, total: 3, current: 1 }).amounts; // [34,33,33]
    const tail = planInstallments({ amountCents: 100, amountIsTotal: true, total: 3, current: 2 }).amounts;
    expect(tail).toEqual(whole.slice(1));
  });

  it("propriedade: a soma das parcelas é SEMPRE o total (nenhum centavo se perde)", () => {
    const next = rng(42);
    for (let i = 0; i < 500; i++) {
      const total = 2 + Math.floor(next() * 119);
      const cents = total + Math.floor(next() * 5_000_000);
      const p = planInstallments({ amountCents: cents, amountIsTotal: true, total, current: 1 });
      expect(p.amounts).toHaveLength(total);
      expect(sumCents(p.amounts)).toBe(cents);
      // diferença máxima entre parcelas é 1 centavo
      expect(Math.max(...p.amounts) - Math.min(...p.amounts)).toBeLessThanOrEqual(1);
    }
  });

  it("rejeita parâmetros inválidos", () => {
    const base = { amountCents: 1000, amountIsTotal: true };
    expect(() => planInstallments({ ...base, total: 1, current: 1 })).toThrow(RangeError);
    expect(() => planInstallments({ ...base, total: 121, current: 1 })).toThrow(RangeError);
    expect(() => planInstallments({ ...base, total: 5, current: 0 })).toThrow(RangeError);
    expect(() => planInstallments({ ...base, total: 5, current: 6 })).toThrow(RangeError);
    expect(() => planInstallments({ ...base, total: 2.5, current: 1 })).toThrow(RangeError);
  });
});
