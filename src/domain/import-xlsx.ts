import type { Kind, Status } from "@/types/db";
import { reaisToCents, type Cents } from "./money";

/** Linha já normalizada, pronta para o RPC `import_transactions`. */
export interface ImportRow {
  sheet: string;
  kind: Kind;
  description: string;
  amount_cents: Cents;
  due_date: string; // yyyy-mm-dd
  status: Status;
  person: string | null;
  category: string | null; // nome da categoria padrão
  installment_number: number | null;
  installment_total: number | null;
  group_key: string | null; // liga as parcelas da mesma compra
}
export interface ImportResult { rows: ImportRow[]; skipped: { sheet: string; reason: string; text: string }[]; sheets: string[] }

type Cell = string | number | boolean | Date | null | undefined;
export type SheetInput = { sheet: string; data: Cell[][] };

const MONTHS: Record<string, number> = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };

const norm = (v: Cell) => String(v ?? "").trim();
const key = (v: Cell) => norm(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const toNum = (v: Cell): number | null => {
  if (typeof v === "number") return v;
  const s = norm(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return s && Number.isFinite(n) ? n : null;
};
const pad = (n: number) => String(n).padStart(2, "0");

/** Dia do mês: aceita Date, "15/08/2026", "15/08/0206"... O mês/ano vêm sempre do nome da aba. */
function dayOf(v: Cell): number | null {
  if (v instanceof Date) return v.getUTCDate(); // o leitor devolve meia-noite UTC
  const m = norm(v).match(/^(\d{1,2})[/\-.]/);
  return m ? Number(m[1]) : null;
}

const INCOME_RULES: [RegExp, string][] = [
  [/salario|13 sal|premi|adiantamento|auxilio|vale/, "Salário"],
  [/emprestimo/, "Empréstimos"],
  [/projeto|dudu|mateus|manu|beatriz|celular/, "Extras"],
];
const EXPENSE_RULES: [RegExp, string][] = [
  [/guardar|reserva/, "Guardar"],
  [/aluguel|mudanca|assembl|condominio/, "Moradia"],
  [/agua|luz|energia|internet|vivo|claro|telefone/, "Contas da casa"],
  [/supermercado|mercado|feira|padaria/, "Mercado"],
  [/fast food|restaurante|ifood|lanche|pizza/, "Alimentação fora"],
  [/uber|gasolina|combustivel|onibus|\b99\b|estacionamento/, "Transporte"],
  [/farmacia|medic|consulta|dentista/, "Saúde"],
  [/faculdade|curso|escola|mensalidade/, "Educação"],
  [/racao|filho|pet|veterin/, "Filhos & Pets"],
  [/viagem|passeio|cinema|praia/, "Lazer & Viagem"],
  [/nubank|nubanck|fatura|cartao/, "Cartão de crédito"],
  [/emprestimo|financiamento|\bem\b/, "Dívidas & Empréstimos"],
  [/contador|inss|imposto|\bdas\b|\bmei\b/, "Impostos & Taxas"],
  [/notebook|videogame|terno|celular|vestido|iphone|carteira|maquina|roupa/, "Compras"],
];

export function guessCategory(kind: Kind, description: string): string {
  const d = key(description);
  const rules = kind === "income" ? INCOME_RULES : EXPENSE_RULES;
  const hit = rules.find(([re]) => re.test(d));
  return hit ? hit[1] : kind === "income" ? "Outras receitas" : "Outras despesas";
}

/** Descobre as colunas de cada bloco a partir da linha de cabeçalho. */
function blockColumns(header: Cell[], from: number, to: number) {
  const cols: Record<string, number> = {};
  for (let i = from; i < to; i++) {
    const h = key(header[i]);
    if (h === "data") cols.date = i;
    else if (h.startsWith("descri")) cols.desc = i;
    else if (h === "valor") cols.amount = i;
    else if (h === "nome") cols.person = i;
    else if (h === "status") cols.status = i;
    else if (h === "parcela") cols.num = i;
    else if (h === "parcelas" || h === "total parcelas") cols.total = i;
  }
  return cols;
}

export function parseWorkbook(sheets: SheetInput[]): ImportResult {
  const rows: ImportRow[] = [];
  const skipped: ImportResult["skipped"] = [];
  const used: string[] = [];
  // Se o mesmo nº de parcela reaparece no mesmo grupo, é OUTRA compra com o mesmo nome.
  const seenNumbers = new Map<string, Set<number>>();

  for (const { sheet, data } of sheets) {
    const m = sheet.trim().toUpperCase().match(/^([A-ZÇ]{3})\s*(\d{2})$/);
    if (!m || !MONTHS[m[1]]) continue; // abas que não são de mês são ignoradas
    const year = 2000 + Number(m[2]);
    const month = MONTHS[m[1]];
    const lastDay = new Date(year, month, 0).getDate();

    const headerIdx = data.findIndex((r) => r?.some((c) => key(c) === "data") && r.some((c) => key(c) === "valor"));
    if (headerIdx < 0) continue;
    used.push(sheet);
    const header = data[headerIdx];
    const dataCols = header.map((c, i) => (key(c) === "data" ? i : -1)).filter((i) => i >= 0);
    const leftEnd = dataCols[1] ?? header.length;
    const blocks: { kind: Kind; cols: Record<string, number> }[] = [
      { kind: "income", cols: blockColumns(header, dataCols[0], leftEnd) },
    ];
    if (dataCols[1] !== undefined) blocks.push({ kind: "expense", cols: blockColumns(header, dataCols[1], header.length) });

    for (let r = headerIdx + 1; r < data.length; r++) {
      const row = data[r] ?? [];
      for (const { kind, cols } of blocks) {
        const description = norm(row[cols.desc]);
        const amount = toNum(row[cols.amount]);
        if (!description && !amount) continue;
        // linha de total (fórmula SUM): só tem o valor, sem data/nome/status
        if (!description && !norm(row[cols.date]) && !norm(row[cols.person])) continue;
        if (!description || amount === null || amount <= 0) {
          skipped.push({ sheet, reason: !description ? "sem descrição" : "sem valor", text: description || `linha ${r + 1}` });
          continue;
        }
        const day = Math.min(dayOf(row[cols.date]) ?? 1, lastDay);
        const st = key(row[cols.status]);
        const num = toNum(row[cols.num]);
        const total = toNum(row[cols.total]);
        const isInst = num !== null && total !== null && Number.isInteger(num) && Number.isInteger(total) && total > 1 && total <= 120 && num >= 1 && num <= total;

        let group_key: string | null = null;
        if (isInst) {
          let k = `${key(description)}|${total}`;
          while (seenNumbers.get(k)?.has(num)) k += "+";
          if (!seenNumbers.has(k)) seenNumbers.set(k, new Set());
          seenNumbers.get(k)!.add(num);
          group_key = k;
        }

        rows.push({
          sheet, kind, description, amount_cents: reaisToCents(amount),
          due_date: `${year}-${pad(month)}-${pad(day)}`,
          status: st === "pago" || st === "recebido" ? "done" : "pending",
          person: norm(row[cols.person]) || null,
          category: guessCategory(kind, description),
          installment_number: isInst ? num : null,
          installment_total: isInst ? total : null,
          group_key,
        });
      }
    }
  }
  return { rows, skipped, sheets: used };
}

/** Linhas no formato aceito por `import_transactions` (sem campos só de exibição). */
export function toImportPayload(rows: readonly ImportRow[]) {
  return rows.map((r) => ({
    kind: r.kind, description: r.description, amount_cents: r.amount_cents, due_date: r.due_date, status: r.status,
    person: r.person, category: r.category, group_key: r.group_key,
    installment_number: r.installment_number, installment_total: r.installment_total,
  }));
}
