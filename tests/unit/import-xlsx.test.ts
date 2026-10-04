import { describe, expect, it } from "vitest";
import { guessCategory, parseWorkbook, toImportPayload, type SheetInput } from "@/domain/import-xlsx";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day)); // o leitor devolve UTC

/** Monta uma aba no mesmo layout da planilha real: título nas 4 primeiras linhas, cabeçalho na linha 5. */
function sheet(name: string, income: unknown[][], expense: unknown[][]): SheetInput {
  const header = ["Data", "Descrição", "Valor", "Nome", "Status", "Parcela", "Parcelas", null, "Data", "Descrição ", "Parcela", "Total Parcelas", "Valor", "Nome", "Status"];
  const n = Math.max(income.length, expense.length);
  const rows: unknown[][] = [[], [], [], [], header];
  for (let i = 0; i < n; i++) {
    // cada bloco tem largura fixa (receitas: 7 colunas A–G; despesas: 7 colunas I–O)
    const pad = (row: unknown[] = []) => Array.from({ length: 7 }, (_, k) => row[k] ?? null);
    rows.push([...pad(income[i]), null, ...pad(expense[i])]);
  }
  return { sheet: name, data: rows as SheetInput["data"] };
}

describe("parseWorkbook", () => {
  const income = [
    [d(2026, 7, 3), "Salário TTX", 1034, "Gabriel", "Recebido"],
    [d(2026, 7, 20), "Projeto Manu", "1.500,50", "Emanuelle", "Pendente"],
    [null, null, 5000, null, null], // linha de total (SUM): só valor
  ];
  const expense = [
    [d(2026, 7, 20), "Notebook", 8, 10, 477, "Gabriel", "Pago"],
    [d(2026, 7, 7), "Aluguel", null, null, 1000, "Emanuelle", "Pendente"],
    [d(2026, 7, 7), "Ajuda Gasolina", null, null, null, "Gabriel", "Pago"], // sem valor
    [null, "Uber", null, null, 93, "Gabriel", "Pago"], // sem data → dia 1
  ];
  const wb = parseWorkbook([sheet("JUL26", income, expense), { sheet: "Resumo", data: [["x"]] }]);

  it("lê só abas de mês e informa quais usou", () => expect(wb.sheets).toEqual(["JUL26"]));

  it("receitas e despesas em centavos, com data e status corretos (sem erro de fuso)", () => {
    const salary = wb.rows.find((r) => r.description === "Salário TTX")!;
    expect(salary).toMatchObject({ kind: "income", amount_cents: 103400, due_date: "2026-07-03", status: "done", person: "Gabriel", category: "Salário" });
    const projeto = wb.rows.find((r) => r.description === "Projeto Manu")!;
    expect(projeto).toMatchObject({ amount_cents: 150050, status: "pending", due_date: "2026-07-20" }); // "1.500,50" em texto
    expect(wb.rows.find((r) => r.description === "Uber")).toMatchObject({ due_date: "2026-07-01", amount_cents: 9300 });
  });

  it("identifica parcelas e gera a chave do grupo", () => {
    expect(wb.rows.find((r) => r.description === "Notebook")).toMatchObject({
      installment_number: 8, installment_total: 10, group_key: "notebook|10", category: "Compras",
    });
    expect(wb.rows.find((r) => r.description === "Aluguel")).toMatchObject({ installment_number: null, group_key: null });
  });

  it("ignora linhas de total em silêncio e relata linhas sem valor", () => {
    expect(wb.rows).toHaveLength(5);
    expect(wb.skipped).toEqual([{ sheet: "JUL26", reason: "sem valor", text: "Ajuda Gasolina" }]);
  });

  it("o mês vem do nome da aba, mesmo que a data da célula seja de outro mês (abas copiadas)", () => {
    const r = parseWorkbook([sheet("FEV26", [[d(2026, 12, 7), "Salário", 2125, "Gabriel", "Pendente"]], [])]);
    expect(r.rows[0].due_date).toBe("2026-02-07");
  });

  it("limita o dia ao fim do mês e entende datas em texto (inclusive com ano quebrado)", () => {
    const r = parseWorkbook([sheet("FEV27", [[d(2026, 1, 31), "A", 100, "X", ""], ["15/08/0206", "B", 100, "X", ""]], [])]);
    expect(r.rows.map((x) => x.due_date)).toEqual(["2027-02-28", "2027-02-15"]);
  });

  it("mesmo nº de parcela repetido = outra compra (grupos diferentes)", () => {
    const exp = [
      [d(2026, 7, 1), "Celular", 4, 10, 434, "G", "Pago"],
      [d(2026, 7, 2), "Celular", 4, 10, 500, "G", "Pago"],
      [d(2026, 7, 3), "Celular", 5, 10, 434, "G", "Pago"],
    ];
    const r = parseWorkbook([sheet("JUL26", [], exp)]);
    const keys = r.rows.map((x) => x.group_key);
    expect(keys[0]).toBe("celular|10");
    expect(keys[1]).toBe("celular|10+");
    expect(keys[2]).toBe("celular|10");
  });

  it("número de parcelas absurdo não vira parcelamento", () => {
    const r = parseWorkbook([sheet("JUL26", [], [[d(2026, 7, 1), "X", 5, 999, 100, "G", ""], [d(2026, 7, 1), "Y", 3, 2, 100, "G", ""]])]);
    expect(r.rows.every((x) => x.group_key === null)).toBe(true);
  });

  it("toImportPayload remove campos só de exibição", () => {
    const [first] = toImportPayload(wb.rows);
    expect(first).not.toHaveProperty("sheet");
    expect(first).toHaveProperty("amount_cents");
  });
});

describe("guessCategory", () => {
  it.each([
    ["expense", "Supermercado", "Mercado"],
    ["expense", "Conta de Água", "Contas da casa"],
    ["expense", "Fatura Nubank", "Cartão de crédito"],
    ["expense", "Uber", "Transporte"],
    ["expense", "Ração Filho", "Filhos & Pets"],
    ["expense", "Guardar", "Guardar"],
    ["expense", "Coisa estranha", "Outras despesas"],
    ["income", "Salário TTX - Prêmio", "Salário"],
    ["income", "Empréstimo Aluguel", "Empréstimos"],
    ["income", "Qualquer", "Outras receitas"],
  ] as const)("%s · %s → %s", (kind, desc, expected) => {
    expect(guessCategory(kind, desc)).toBe(expected);
  });
});
