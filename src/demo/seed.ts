import type { Query } from "./server-db";

export const DEMO_EMAIL = "demo@financas.app";

// PRNG determinístico: a demonstração é sempre igual.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** primeiro dia do mês deslocado `offset` meses a partir de `base` */
function monthStart(base: Date, offset: number) {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1, iso: ymd(d.getFullYear(), d.getMonth() + 1, 1), last: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() };
}

/** Dados 100% fictícios (casal "Lucas" e "Marina") espalhados por 7 meses ao redor de hoje. */
export async function seedDemo(q: Query, householdId: string) {
  const rnd = mulberry32(2026);
  const money = (a: number, b: number) => Math.round((a + rnd() * (b - a)) * 100); // centavos
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];

  const now = new Date();
  const todayIso = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());

  await q("insert into people (household_id, name, color) values ($1, 'Marina', '#ec4899')", [householdId]);
  const cat = new Map((await q<{ id: string; name: string }>("select id, name from categories")).map((c) => [c.name, c.id]));
  const person = new Map((await q<{ id: string; name: string }>("select id, name from people")).map((p) => [p.name, p.id]));
  const account = new Map((await q<{ id: string; name: string }>("select id, name from accounts")).map((a) => [a.name, a.id]));
  const lucas = person.get("Lucas")!, marina = person.get("Marina")!;
  const conta = account.get("Conta principal")!, cartao = account.get("Cartão de crédito")!;

  const first = monthStart(now, -5);

  // ---- Fixos mensais -----------------------------------------------------
  const rules: [string, string, number, number, string, string, string][] = [
    // kind, descrição, reais, dia, categoria, pessoa, conta
    ["income", "Salário Lucas", 6400, 5, "Salário", "Lucas", "Conta principal"],
    ["income", "Salário Marina", 4800, 7, "Salário", "Marina", "Conta principal"],
    ["expense", "Aluguel", 1850, 10, "Moradia", "Lucas", "Conta principal"],
    ["expense", "Condomínio", 480, 10, "Moradia", "Lucas", "Conta principal"],
    ["expense", "Academia", 110, 8, "Saúde", "Lucas", "Cartão de crédito"],
    ["expense", "Energia", 210, 12, "Contas da casa", "Lucas", "Conta principal"],
    ["expense", "Internet", 120, 15, "Contas da casa", "Marina", "Conta principal"],
    ["expense", "Faculdade", 650, 15, "Educação", "Marina", "Conta principal"],
    ["expense", "Celular", 95, 18, "Contas da casa", "Lucas", "Cartão de crédito"],
    ["expense", "Streaming", 55, 20, "Lazer & Viagem", "Marina", "Cartão de crédito"],
    ["expense", "Reserva de emergência", 800, 28, "Guardar", "Lucas", "Conta principal"],
  ];
  for (const [kind, desc, reais, day, c, p, a] of rules) {
    await q(
      `select public.create_recurring(p_kind => $1, p_description => $2, p_amount_cents => $3, p_day => $4, p_start_month => $5,
         p_person_id => $6, p_category_id => $7, p_account_id => $8, p_first_done => false, p_today => $9)`,
      [kind, desc, reais * 100, day, first.iso, person.get(p)!, cat.get(c)!, account.get(a)!, todayIso],
    );
  }
  for (let off = -4; off <= 1; off++) await q("select public.materialize_recurring($1)", [monthStart(now, off).iso]);

  // ---- Gastos do dia a dia ----------------------------------------------
  const groups: [string, string[], number, number, number][] = [
    // categoria, descrições, nº por mês, mín, máx (reais)
    ["Mercado", ["Supermercado Extra", "Mercado do bairro", "Hortifruti", "Padaria"], 4, 40, 420],
    ["Alimentação fora", ["iFood", "Restaurante", "Lanchonete", "Café"], 6, 22, 140],
    ["Transporte", ["Uber", "99", "Gasolina", "Estacionamento"], 8, 12, 230],
    ["Saúde", ["Farmácia"], 2, 30, 180],
    ["Lazer & Viagem", ["Cinema", "Bar com amigos", "Show"], 3, 40, 220],
    ["Compras", ["Roupas", "Presente", "Casa & decoração"], 2, 60, 380],
    ["Filhos & Pets", ["Ração", "Petshop"], 2, 80, 160],
  ];
  for (let off = -5; off <= 1; off++) {
    const ms = monthStart(now, off);
    for (const [c, descs, n, lo, hi] of groups) {
      for (let i = 0; i < n; i++) {
        const date = ymd(ms.y, ms.m, 1 + Math.floor(rnd() * ms.last));
        await q(
          `insert into transactions (household_id, kind, description, amount_cents, due_date, category_id, person_id, account_id)
           values ($1, 'expense', $2, $3, $4, $5, $6, $7)`,
          [householdId, pick(descs), money(lo, hi), date, cat.get(c)!, rnd() < 0.6 ? lucas : marina, rnd() < 0.55 ? cartao : conta],
        );
      }
    }
  }

  // ---- Receitas extras ---------------------------------------------------
  const m2 = monthStart(now, -2), m0 = monthStart(now, 0);
  await q(`insert into transactions (household_id, kind, description, amount_cents, due_date, category_id, person_id, account_id)
           values ($1, 'income', 'Freela de design', 120000, $2, $3, $4, $5), ($1, 'income', 'Reembolso plano de saúde', 18000, $6, $3, $4, $5)`,
    [householdId, ymd(m2.y, m2.m, 18), cat.get("Extras")!, marina, conta, ymd(m0.y, m0.m, Math.min(24, m0.last))]);

  // ---- Compras parceladas -------------------------------------------------
  const inst = async (desc: string, cents: number, total: number, startOffset: number, day: number, c: string, p: string) => {
    const ms = monthStart(now, startOffset);
    await q(
      `select public.create_installments(p_kind => 'expense', p_description => $1, p_amount_cents => $2, p_amount_is_total => false,
         p_first_due => $3, p_total => $4, p_current => 1::smallint, p_person_id => $5, p_category_id => $6, p_account_id => $7,
         p_notes => null, p_first_done => false, p_today => $8)`,
      [desc, cents, ymd(ms.y, ms.m, Math.min(day, ms.last)), total, person.get(p)!, cat.get(c)!, cartao, todayIso],
    );
  };
  await inst("Notebook", 47700, 10, -4, 20, "Compras", "Lucas");
  await inst("Celular novo", 28900, 12, -2, 12, "Compras", "Marina");
  await inst("Viagem para a praia", 34300, 6, -1, 25, "Lazer & Viagem", "Marina");
  await inst("Sofá", 38000, 8, -5, 5, "Moradia", "Lucas");

  // ---- Situação: o que já passou foi pago; deixa 2 contas atrasadas --------
  await q("update transactions set status = 'done', settled_at = due_date where due_date <= $1::date", [todayIso]);
  await q(
    `update transactions set status = 'pending', settled_at = null
     where description in ('Energia', 'Faculdade') and due_date between $1::date - 9 and $1::date - 1`,
    [todayIso],
  );

  // ---- Alguns itens para mostrar atraso / vence hoje / vence amanhã ------------
  const rel = (days: number) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const extra: [string, number, number, string, string, string][] = [
    ["Fatura do cartão", 124035, -1, "Cartão de crédito", "Lucas", "Conta principal"],
    ["Seguro do carro", 18990, -3, "Transporte", "Lucas", "Conta principal"],
    ["Mensalidade do pet", 14000, 0, "Filhos & Pets", "Marina", "Cartão de crédito"],
    ["Dentista", 25000, 1, "Saúde", "Marina", "Conta principal"],
  ];
  for (const [desc, cents, days, c, p, a] of extra) {
    await q(`insert into transactions (household_id, kind, description, amount_cents, due_date, category_id, person_id, account_id)
             values ($1, 'expense', $2, $3, $4, $5, $6, $7)`, [householdId, desc, cents, rel(days), cat.get(c)!, person.get(p)!, account.get(a)!]);
  }

  // ---- Orçamento ---------------------------------------------------------
  const budgets: [string, number][] = [["Mercado", 1700], ["Alimentação fora", 620], ["Transporte", 1500], ["Lazer & Viagem", 800], ["Compras", 1600], ["Saúde", 800]];
  for (let off = -5; off <= 1; off++) {
    for (const [c, reais] of budgets) {
      await q("insert into budgets (household_id, category_id, month, amount_cents) values ($1, $2, $3, $4)", [householdId, cat.get(c)!, monthStart(now, off).iso, reais * 100]);
    }
  }
}
