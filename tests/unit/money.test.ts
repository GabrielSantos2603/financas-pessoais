import { describe, expect, it } from "vitest";
import { parseCents, percentOf, reaisToCents, sumCents } from "@/domain/money";
import { formatCentsInput, money, moneyCompact, pct } from "@/lib/format";

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("domain/money", () => {
  it("soma centavos sem erro de ponto flutuante", () => {
    // 0.1 + 0.2 em reais daria 0.30000000000000004
    expect(sumCents([10, 20])).toBe(30);
    expect(sumCents(Array.from({ length: 1000 }, () => 10))).toBe(10_000);
    expect(sumCents([])).toBe(0);
  });

  it("parseCents lê só os dígitos (máscara de caixa eletrônico)", () => {
    expect(parseCents("")).toBe(0);
    expect(parseCents("5")).toBe(5);
    expect(parseCents("1.234,56")).toBe(123456);
    expect(parseCents("R$ 0,07")).toBe(7);
    expect(parseCents("abc")).toBe(0);
  });

  it("parseCents limita o tamanho (evita estourar o inteiro seguro)", () => {
    expect(Number.isSafeInteger(parseCents("9".repeat(40)))).toBe(true);
  });

  it("reaisToCents arredonda corretamente valores da planilha", () => {
    expect(reaisToCents(477)).toBe(47700);
    expect(reaisToCents(810.5)).toBe(81050);
    expect(reaisToCents(19.99)).toBe(1999);
    expect(reaisToCents(0.1 + 0.2)).toBe(30);
    expect(reaisToCents(1234.56)).toBe(123456);
  });

  it("percentOf protege contra divisão por zero", () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(5, 0)).toBe(0);
  });
});

describe("lib/format", () => {
  it("formata centavos como moeda brasileira", () => {
    expect(nbsp(money(123456))).toBe("R$ 1.234,56");
    expect(nbsp(money(0))).toBe("R$ 0,00");
    expect(nbsp(money(5))).toBe("R$ 0,05");
    expect(nbsp(money(-1050))).toMatch(/-R\$ 10,50/);
  });
  it("formata o campo de entrada e o compacto", () => {
    expect(formatCentsInput(123456)).toBe("1.234,56");
    expect(formatCentsInput(0)).toBe("0,00");
    expect(nbsp(moneyCompact(1_500_000))).toMatch(/^R\$ 15\s?mil$/i);
    expect(pct(33.4)).toBe("33%");
  });
});
