import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Client, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

interface Row {
  id: string; description: string; amount_cents: number; due_date: string; status: string;
  installment_number: number | null; installment_total: number | null; installment_group: string | null;
  category_id: string | null; settled_at: string | null; recurring_id: string | null;
}
const rows = (c: Client, where = "true") =>
  c.query<Row>(`select id, description, amount_cents::int, to_char(due_date,'YYYY-MM-DD') due_date, status, installment_number, installment_total,
                       installment_group, category_id, to_char(settled_at,'YYYY-MM-DD') settled_at, recurring_id
                from transactions where ${where} order by due_date, installment_number nulls first`).then((r) => r.rows);

const baseInst = {
  p_kind: "expense", p_description: "Notebook", p_amount_cents: 100000, p_amount_is_total: true,
  p_first_due: "2026-10-20", p_total: 3, p_current: 1, p_person_id: null, p_category_id: null,
  p_account_id: null, p_notes: null, p_first_done: false, p_today: "2026-10-04",
};

describe("create_installments", () => {
  it("divide o total em centavos inteiros, sobras nas primeiras parcelas", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      await c.rpc("create_installments", baseInst); // R$ 1.000,00 / 3
      const r = await rows(c);
      expect(r.map((x) => x.amount_cents)).toEqual([33334, 33333, 33333]);
      expect(r.reduce((a, x) => a + x.amount_cents, 0)).toBe(100000); // nenhum centavo perdido
      expect(r.map((x) => x.due_date)).toEqual(["2026-10-20", "2026-11-20", "2026-12-20"]);
      expect(r.map((x) => `${x.installment_number}/${x.installment_total}`)).toEqual(["1/3", "2/3", "3/3"]);
      expect(new Set(r.map((x) => x.installment_group)).size).toBe(1);
    });
  });

  it("modo 'valor da parcela' multiplica pelo total", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      await c.rpc("create_installments", { ...baseInst, p_amount_cents: 47700, p_amount_is_total: false, p_total: 10, p_current: 8 });
      const r = await rows(c);
      expect(r).toHaveLength(3); // parcelas 8, 9 e 10
      expect(r.map((x) => x.installment_number)).toEqual([8, 9, 10]);
      expect(r.every((x) => x.amount_cents === 47700)).toBe(true);
    });
  });

  it("preserva o dia-limite do mês (31/01 → 28/02 → 31/03) e marca só a primeira como paga", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      await c.rpc("create_installments", { ...baseInst, p_first_due: "2027-01-31", p_first_done: true });
      const r = await rows(c);
      expect(r.map((x) => x.due_date)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
      expect(r.map((x) => x.status)).toEqual(["done", "pending", "pending"]);
      expect(r[0].settled_at).toBe("2026-10-04");
      expect(r[1].settled_at).toBeNull();
    });
  });

  it("parâmetros inválidos falham sem gravar nada", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      expect(await c.fails(() => c.rpc("create_installments", { ...baseInst, p_total: 1 }))).toMatch(/inválido/i);
      expect(await c.fails(() => c.rpc("create_installments", { ...baseInst, p_current: 4 }))).toMatch(/inválido/i);
      expect(await rows(c)).toHaveLength(0);
    });
  });

  it("é atômico: categoria de outra casa derruba o lote inteiro", async () => {
    const a = await db.householdFor();
    const b = await db.householdFor();
    const foreign = await db.categoryId(b.user, "Mercado");
    await db.as(a.user, async (c) => {
      const msg = await c.fails(() => c.rpc("create_installments", { ...baseInst, p_category_id: foreign }));
      expect(msg).toMatch(/foreign key/i);
      expect(await rows(c)).toHaveLength(0);
    });
  });
});

describe("update_transaction / delete_transactions (escopo)", () => {
  async function seed() {
    const h = await db.householdFor();
    const cat = await db.categoryId(h.user, "Compras");
    await db.as(h.user, (c) => c.rpc("create_installments", { ...baseInst, p_total: 4, p_amount_cents: 40000 }));
    const ids = await db.as(h.user, async (c) => (await rows(c)).map((r) => r.id));
    const patch = (id: string, over: Record<string, unknown> = {}) => ({
      p_id: id, p_scope: "one", p_kind: "expense", p_description: "Notebook Pro", p_amount_cents: 12345,
      p_due_date: "2026-11-25", p_done: true, p_person_id: null, p_category_id: cat, p_account_id: null,
      p_notes: " obs ", p_today: "2026-10-04", ...over,
    });
    return { ...h, ids, cat, patch };
  }

  it("'one' altera só a parcela escolhida", async () => {
    const { user, ids, patch, cat } = await seed();
    await db.as(user, async (c) => {
      expect(await c.rpc("update_transaction", patch(ids[1]))).toBe(1);
      const r = await rows(c);
      expect(r[1]).toMatchObject({ description: "Notebook Pro", amount_cents: 12345, due_date: "2026-11-25", status: "done", category_id: cat });
      expect(r[2]).toMatchObject({ description: "Notebook", amount_cents: 10000, status: "pending", category_id: null });
    });
  });

  it("'following' propaga campos comuns às próximas, mas data/situação só à atual", async () => {
    const { user, ids, patch } = await seed();
    await db.as(user, async (c) => {
      expect(await c.rpc("update_transaction", patch(ids[1], { p_scope: "following" }))).toBe(3); // parcelas 2, 3 e 4
      const r = await rows(c);
      expect(r[0]).toMatchObject({ description: "Notebook", amount_cents: 10000 }); // anterior intacta
      expect(r[1]).toMatchObject({ description: "Notebook Pro", amount_cents: 12345, due_date: "2026-11-25", status: "done" });
      expect(r[2]).toMatchObject({ description: "Notebook Pro", amount_cents: 12345, due_date: "2026-12-20", status: "pending" });
      expect(r[3]).toMatchObject({ description: "Notebook Pro", amount_cents: 12345, due_date: "2027-01-20", status: "pending" });
    });
  });

  it("falha no meio não deixa edição parcial (atomicidade)", async () => {
    const a = await seed();
    const b = await db.householdFor();
    const foreign = await db.categoryId(b.user, "Mercado");
    await db.as(a.user, async (c) => {
      const before = await rows(c);
      const msg = await c.fails(() => c.rpc("update_transaction", a.patch(a.ids[1], { p_scope: "following", p_category_id: foreign })));
      expect(msg).toMatch(/foreign key/i);
      expect(await rows(c)).toEqual(before);
    });
  });

  it("p_done=false limpa settled_at; escopo inválido e id inexistente falham", async () => {
    const { user, ids, patch } = await seed();
    await db.as(user, async (c) => {
      await c.rpc("update_transaction", patch(ids[0]));
      expect((await rows(c, `id = '${ids[0]}'`))[0].settled_at).toBe("2026-10-04");
      await c.rpc("update_transaction", patch(ids[0], { p_done: false }));
      expect((await rows(c, `id = '${ids[0]}'`))[0]).toMatchObject({ status: "pending", settled_at: null });
      expect(await c.fails(() => c.rpc("update_transaction", patch(ids[0], { p_scope: "all" })))).toMatch(/escopo/i);
      expect(await c.fails(() => c.rpc("update_transaction", patch("00000000-0000-0000-0000-000000000000")))).toMatch(/não encontrado/i);
    });
  });

  it("outra casa não consegue editar nem apagar (não encontrado)", async () => {
    const { ids, patch } = await seed();
    const intruder = await db.householdFor();
    await db.as(intruder.user, async (c) => {
      expect(await c.fails(() => c.rpc("update_transaction", patch(ids[0])))).toMatch(/não encontrado/i);
      expect(await c.fails(() => c.rpc("delete_transactions", { p_id: ids[0], p_scope: "one" }))).toMatch(/não encontrado/i);
    });
  });

  it("delete 'one' remove uma; 'following' remove a atual e as seguintes", async () => {
    const { user, ids } = await seed();
    await db.as(user, async (c) => {
      expect(await c.rpc("delete_transactions", { p_id: ids[0], p_scope: "one" })).toBe(1);
      expect(await rows(c)).toHaveLength(3);
      expect(await c.rpc("delete_transactions", { p_id: ids[2], p_scope: "following" })).toBe(2);
      expect((await rows(c)).map((r) => r.installment_number)).toEqual([2]);
    });
  });
});

describe("fixos mensais", () => {
  const rule = {
    p_kind: "expense", p_description: "Aluguel", p_amount_cents: 135000, p_day: 31,
    p_start_month: "2026-01-01", p_person_id: null, p_category_id: null, p_account_id: null,
    p_first_done: false, p_today: "2026-10-04",
  };

  it("create_recurring cria a regra e o lançamento do mês inicial", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      const rid = await c.rpc<string>("create_recurring", { ...rule, p_first_done: true });
      const r = await rows(c);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ description: "Aluguel", amount_cents: 135000, due_date: "2026-01-31", status: "done", recurring_id: rid });
    });
  });

  it("materialize_recurring é idempotente e limita o dia ao fim do mês", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      await c.rpc("create_recurring", rule);
      expect(await c.rpc("materialize_recurring", { p_month: "2026-02-10" })).toBe(1);
      expect(await c.rpc("materialize_recurring", { p_month: "2026-02-10" })).toBe(0); // 2ª vez não duplica
      expect((await rows(c, "recurring_id is not null")).map((r) => r.due_date)).toEqual(["2026-01-31", "2026-02-28"]);
    });
  });

  it("não gera meses anteriores ao início nem com a regra pausada", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      const rid = await c.rpc<string>("create_recurring", { ...rule, p_start_month: "2026-06-01", p_day: 5 });
      expect(await c.rpc("materialize_recurring", { p_month: "2026-05-01" })).toBe(0);
      await c.query("update recurring_rules set active = false where id = $1", [rid]);
      expect(await c.rpc("materialize_recurring", { p_month: "2026-07-01" })).toBe(0);
    });
  });

  it("update_recurring propaga só para pendentes a partir do mês indicado (histórico pago intacto)", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      const rid = await c.rpc<string>("create_recurring", { ...rule, p_day: 5 });
      for (const m of ["2026-02-01", "2026-03-01", "2026-04-01"]) await c.rpc("materialize_recurring", { p_month: m });
      await c.query("update transactions set status = 'done', settled_at = '2026-02-05' where due_date = '2026-02-05'");

      const n = await c.rpc<number>("update_recurring", {
        p_id: rid, p_description: "Aluguel novo", p_amount_cents: 150000, p_day: 10, p_person_id: null,
        p_category_id: null, p_account_id: null, p_active: true, p_from_month: "2026-02-15",
      });
      expect(n).toBe(2); // março e abril (fevereiro está pago; janeiro é anterior)
      const r = await rows(c, "recurring_id is not null");
      expect(r.find((x) => x.due_date === "2026-01-05")).toMatchObject({ description: "Aluguel", amount_cents: 135000 });
      expect(r.find((x) => x.due_date === "2026-02-05")).toMatchObject({ description: "Aluguel", status: "done" });
      expect(r.find((x) => x.due_date === "2026-03-10")).toMatchObject({ description: "Aluguel novo", amount_cents: 150000 });
      expect(r.find((x) => x.due_date === "2026-04-10")).toMatchObject({ description: "Aluguel novo", amount_cents: 150000 });
    });
  });

  it("delete_recurring apaga pendentes futuros e mantém o histórico pago", async () => {
    const { user } = await db.householdFor();
    await db.as(user, async (c) => {
      const rid = await c.rpc<string>("create_recurring", { ...rule, p_day: 5, p_first_done: true });
      for (const m of ["2026-02-01", "2026-03-01"]) await c.rpc("materialize_recurring", { p_month: m });
      expect(await c.rpc("delete_recurring", { p_id: rid, p_from: "2026-02-01" })).toBe(2);
      const r = await rows(c);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ due_date: "2026-01-05", status: "done", recurring_id: null }); // vínculo zerado, histórico mantido
      expect((await c.query("select 1 from recurring_rules")).rows).toHaveLength(0);
    });
  });
});
