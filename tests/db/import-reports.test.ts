import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

const row = (over: Record<string, unknown>) => ({
  kind: "expense", description: "Item", amount_cents: 1000, due_date: "2026-10-05", status: "pending",
  person: null, category: null, group_key: null, installment_number: null, installment_total: null, ...over,
});

describe("import_transactions", () => {
  it("cria pessoas, resolve categorias por nome, liga parcelas e reporta contagens", async () => {
    const { user } = await db.householdFor("Casa", "Gabriel");
    await db.as(user, async (c) => {
      const res = await c.rpc<{ inserted: number; duplicates: number }>("import_transactions", {
        p_rows: [
          row({ description: "Salário TTX", kind: "income", amount_cents: 185000, status: "done", person: "Gabriel", category: "Salário" }),
          row({ description: "Projeto", kind: "income", amount_cents: 100000, person: "Emanuelle", category: "Extras" }),
          row({ description: "Notebook", amount_cents: 47700, due_date: "2026-08-20", status: "done", category: "Compras", person: "Gabriel", group_key: "notebook|10", installment_number: 9, installment_total: 10 }),
          row({ description: "Notebook", amount_cents: 47700, due_date: "2026-09-20", category: "Compras", person: "Gabriel", group_key: "notebook|10", installment_number: 10, installment_total: 10 }),
          row({ description: "Sem categoria", category: "Não existe" }),
        ],
      });
      expect(res).toEqual({ inserted: 5, duplicates: 0 });

      const people = (await c.query<{ name: string }>("select name from people order by name")).rows.map((p) => p.name);
      expect(people).toEqual(["Emanuelle", "Gabriel"]); // Gabriel já existia: sem duplicar

      const { rows } = await c.query<{ description: string; person: string | null; category: string | null; settled_at: string | null }>(
        `select t.description, p.name person, c.name category, to_char(t.settled_at,'YYYY-MM-DD') settled_at
         from transactions t left join people p on p.id = t.person_id left join categories c on c.id = t.category_id order by t.description, t.due_date`);
      expect(rows.find((r) => r.description === "Salário TTX")).toMatchObject({ person: "Gabriel", category: "Salário", settled_at: "2026-10-05" });
      expect(rows.find((r) => r.description === "Sem categoria")?.category).toBeNull();

      const groups = (await c.query<{ g: string; n: number }>("select installment_group g, count(*)::int n from transactions where installment_group is not null group by 1")).rows;
      expect(groups).toHaveLength(1);
      expect(groups[0].n).toBe(2);
    });
  });

  it("importar de novo não duplica (mas duplicatas DENTRO do arquivo são mantidas)", async () => {
    const { user } = await db.householdFor();
    const payload = [row({ description: "Uber", amount_cents: 10000 }), row({ description: "Uber", amount_cents: 10000 }), row({ description: "Mercado", amount_cents: 80000 })];
    await db.as(user, async (c) => {
      expect(await c.rpc("import_transactions", { p_rows: payload })).toEqual({ inserted: 3, duplicates: 0 });
      expect(await c.rpc("import_transactions", { p_rows: payload })).toEqual({ inserted: 0, duplicates: 3 });
      expect((await c.query("select 1 from transactions")).rows).toHaveLength(3);
    });
  });

  it("é atômico: uma linha inválida desfaz tudo, inclusive as pessoas criadas", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      const msg = await c.fails(() => c.rpc("import_transactions", {
        p_rows: [row({ description: "OK", person: "Fulana" }), row({ description: "Ruim", amount_cents: -1 })],
      }));
      expect(msg).toMatch(/check constraint/i);
      expect((await c.query("select 1 from transactions")).rows).toHaveLength(0);
      expect((await c.query("select 1 from people where name = 'Fulana'")).rows).toHaveLength(0);
    });
  });

  it("valida formato e tamanho; enum inválido falha", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      expect(await c.fails(() => c.rpc("import_transactions", { p_rows: { a: 1 } }))).toMatch(/formato/i);
      expect(await c.fails(() => c.rpc("import_transactions", { p_rows: Array.from({ length: 5001 }, () => row({})) }))).toMatch(/grande demais/i);
      expect(await c.fails(() => c.rpc("import_transactions", { p_rows: [row({ kind: "transfer" })] }))).toMatch(/invalid input value for enum/i);
    });
  });
});

describe("relatórios no banco", () => {
  async function seed() {
    const h = await db.householdFor("Casa", "Gabriel");
    const [mercado, guardar, salario] = await Promise.all(["Mercado", "Guardar", "Salário"].map((n) => db.categoryId(h.user, n)));
    const gabriel = await db.personId(h.user, "Gabriel");
    await db.as(h.user, async (c) => {
      const ins = (kind: string, cents: number, date: string, status: string, cat: string | null, person: string | null = null) =>
        c.query(`insert into transactions (household_id, kind, description, amount_cents, due_date, status, category_id, person_id)
                 values ($1, $2, 'x', $3, $4, $5, $6, $7)`, [h.house, kind, cents, date, status, cat, person]);
      await ins("income", 500000, "2026-09-05", "done", salario);
      await ins("income", 200000, "2026-09-20", "pending", salario);
      await ins("expense", 80000, "2026-09-07", "done", mercado, gabriel);
      await ins("expense", 30000, "2026-09-08", "pending", mercado);
      await ins("expense", 100000, "2026-09-30", "done", guardar, gabriel); // guardado ≠ despesa
      await ins("expense", 5000, "2026-11-02", "pending", null);            // sem categoria
    });
    return { ...h, mercado, guardar };
  }

  it("period_summary separa receita, despesa e guardado, e inclui meses vazios", async () => {
    const { user } = await seed();
    const r = await db.as(user, async (c) => (await c.query<Record<string, number | string>>(
      "select to_char(month,'YYYY-MM') m, income_cents::int i, income_done_cents::int id, expense_cents::int e, expense_done_cents::int ed, saved_cents::int s, saved_done_cents::int sd from period_summary('2026-09-15', '2026-11-30')")).rows);
    expect(r).toEqual([
      { m: "2026-09", i: 700000, id: 500000, e: 110000, ed: 80000, s: 100000, sd: 100000 },
      { m: "2026-10", i: 0, id: 0, e: 0, ed: 0, s: 0, sd: 0 },
      { m: "2026-11", i: 0, id: 0, e: 5000, ed: 0, s: 0, sd: 0 },
    ]);
  });

  it("category_totals e person_totals ignoram guardado e receitas", async () => {
    const { user, mercado } = await seed();
    await db.as(user, async (c) => {
      const cats = (await c.query<{ category_id: string | null; t: number }>("select category_id, total_cents::int t from category_totals('2026-09-01','2026-11-30')")).rows;
      expect(cats).toEqual([{ category_id: mercado, t: 110000 }, { category_id: null, t: 5000 }]);
      const people = (await c.query<{ n: string | null; t: number }>(
        "select p.name n, x.total_cents::int t from person_totals('2026-09-01','2026-09-30') x left join people p on p.id = x.person_id order by 2 desc")).rows;
      expect(people).toEqual([{ n: "Gabriel", t: 80000 }, { n: null, t: 30000 }]);
    });
  });

  it("relatórios só enxergam a casa do usuário (RLS vale nas funções)", async () => {
    await seed();
    const other = await db.householdFor();
    await db.as(other.user, async (c) => {
      const r = await c.query<{ i: number }>("select sum(income_cents)::int i from period_summary('2026-09-01','2026-11-30')");
      expect(r.rows[0].i).toBe(0);
      expect((await c.query("select * from category_totals('2026-01-01','2026-12-31')")).rows).toHaveLength(0);
    });
  });

  it("installment_groups resume cada compra e aponta a próxima parcela pendente", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      const base = {
        p_kind: "expense", p_description: "Videogame", p_amount_cents: 26700, p_amount_is_total: false, p_first_due: "2026-07-20",
        p_total: 6, p_current: 4, p_person_id: null, p_category_id: null, p_account_id: null, p_notes: null, p_first_done: true, p_today: "2026-07-20",
      };
      await c.rpc("create_installments", base);
      await c.rpc("create_installments", { ...base, p_description: "Terno", p_amount_cents: 9000, p_total: 2, p_current: 1, p_first_done: true });
      await c.query("update transactions set status='done', settled_at = due_date where description = 'Terno'"); // quitado
      const { rows } = await c.query<{ description: string; total: number; paid: number; pending: number; rem: number; focus_number: number; focus_status: string }>(
        `select description, total::int, paid_count paid, pending_count pending, remaining_cents::int rem,
                (focus->>'installment_number')::int focus_number, focus->>'status' focus_status from installment_groups()`);
      expect(rows).toEqual([
        { description: "Videogame", total: 6, paid: 1, pending: 2, rem: 53400, focus_number: 5, focus_status: "pending" },
        { description: "Terno", total: 2, paid: 2, pending: 0, rem: 0, focus_number: 2, focus_status: "done" },
      ]);
    });
  });
});
