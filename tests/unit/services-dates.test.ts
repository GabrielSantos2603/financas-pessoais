import { describe, expect, it } from "vitest";
import { fetchAllPages, friendlyMessage, ServiceError, unwrap } from "@/services/db";
import { addMonthsToDate, monthFirstDay, monthKey, monthLabel, monthRange, shiftMonth } from "@/lib/dates";

describe("services/db", () => {
  it("traduz códigos do Postgres em mensagens amigáveis", () => {
    expect(friendlyMessage({ code: "23503", message: "x" })).toMatch(/referencia/i);
    expect(friendlyMessage({ code: "23505", message: "x" })).toMatch(/já existe/i);
    expect(friendlyMessage({ code: "42501", message: "x" })).toMatch(/permissão/i);
    expect(friendlyMessage({ code: "PGRST303", message: "JWT expired" })).toMatch(/sessão expirou/i);
  });

  it("mantém a mensagem das nossas funções (RAISE EXCEPTION) e detecta falta de rede", () => {
    expect(friendlyMessage({ code: "P0001", message: "Muitas tentativas." })).toBe("Muitas tentativas.");
    expect(friendlyMessage({ message: "TypeError: Failed to fetch" })).toMatch(/sem conexão/i);
    expect(friendlyMessage({ message: "" })).toMatch(/algo deu errado/i);
  });

  it("unwrap devolve os dados ou lança ServiceError com código", () => {
    expect(unwrap({ data: [1], error: null })).toEqual([1]);
    try {
      unwrap({ data: null, error: { code: "23505", message: "dup" } });
      throw new Error("deveria lançar");
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceError);
      expect((e as ServiceError).code).toBe("23505");
    }
  });

  it("fetchAllPages percorre todas as páginas (limite de 1000 linhas do PostgREST)", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await fetchAllPages(async (from, to) => { calls.push([from, to]); return { data: all.slice(from, to + 1), error: null }; });
    expect(rows).toHaveLength(2500);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("fetchAllPages para quando a última página vem cheia e a seguinte vazia", async () => {
    const all = Array.from({ length: 2000 }, (_, i) => i);
    const rows = await fetchAllPages(async (from, to) => ({ data: all.slice(from, to + 1), error: null }));
    expect(rows).toHaveLength(2000);
  });

  it("fetchAllPages propaga erro", async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { code: "42501", message: "x" } }))).rejects.toBeInstanceOf(ServiceError);
  });
});

describe("lib/dates", () => {
  it("navega entre meses atravessando o ano", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", -5)).toBe("2026-05");
  });
  it("calcula o intervalo do mês, inclusive fevereiro bissexto", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("rotula e converte chaves de mês", () => {
    expect(monthLabel("2026-10")).toBe("Outubro de 2026");
    expect(monthFirstDay("2026-10")).toBe("2026-10-01");
    expect(monthKey(new Date(2026, 9, 15))).toBe("2026-10");
  });
  it("soma meses preservando o fim de mês", () => {
    expect(addMonthsToDate("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsToDate("2027-01-31", 2)).toBe("2027-03-31");
    expect(addMonthsToDate("2026-10-20", 3)).toBe("2027-01-20");
  });
});
