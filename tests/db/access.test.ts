import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

const insertTx = (house: string, extra = "") =>
  `insert into transactions (household_id, kind, description, amount_cents, due_date ${extra ? "," + extra.split("=")[0] : ""})
   values ('${house}', 'expense', 'Teste', 1000, '2026-10-05' ${extra ? "," + extra.split("=")[1] : ""})`;

describe("isolamento entre casas (RLS)", () => {
  it("um usuário não enxerga nem altera os dados de outra casa", async () => {
    const a = await db.householdFor("A");
    const b = await db.householdFor("B");
    await db.as(a.user, (c) => c.query(insertTx(a.house)));

    expect(await db.as(b.user, async (c) => (await c.query("select * from transactions")).rows)).toHaveLength(0);
    expect(await db.as(a.user, async (c) => (await c.query("select * from transactions")).rows)).toHaveLength(1);

    // B não consegue gravar na casa de A
    const msg = await db.as(b.user, (c) => c.fails(() => c.query(insertTx(a.house))));
    expect(msg).toMatch(/row-level security/i);

    // nem apagar/atualizar (RLS filtra: 0 linhas afetadas)
    await db.as(b.user, async (c) => {
      await c.query("update transactions set description = 'hack'");
      await c.query("delete from transactions");
    });
    const [row] = await db.admin<{ description: string }>("select description from transactions where household_id = $1", [a.house]);
    expect(row.description).toBe("Teste");
  });

  it("usuário anônimo não acessa nada", async () => {
    const msg = await db.as(null, (c) => c.fails(() => c.query("select * from transactions")), "anon");
    expect(msg).toMatch(/permission denied/i);
    const fn = await db.as(null, (c) => c.fails(() => c.rpc("create_household", { p_name: "x", p_person: "y" })), "anon");
    expect(fn).toMatch(/permission denied/i);
  });

  it("rejeita referência a categoria/pessoa/conta de OUTRA casa (FK composta)", async () => {
    const a = await db.householdFor("A");
    const b = await db.householdFor("B");
    const foreignCat = await db.categoryId(b.user, "Mercado");
    const foreignPerson = await db.personId(b.user, "Eu");

    const m1 = await db.as(a.user, (c) =>
      c.fails(() => c.query(`insert into transactions (household_id, kind, description, amount_cents, due_date, category_id)
                             values ($1, 'expense', 'x', 100, '2026-10-01', $2)`, [a.house, foreignCat])));
    expect(m1).toMatch(/foreign key/i);
    const m2 = await db.as(a.user, (c) =>
      c.fails(() => c.query(`insert into transactions (household_id, kind, description, amount_cents, due_date, person_id)
                             values ($1, 'expense', 'x', 100, '2026-10-01', $2)`, [a.house, foreignPerson])));
    expect(m2).toMatch(/foreign key/i);
    const m3 = await db.as(a.user, (c) =>
      c.fails(() => c.query("insert into budgets (household_id, category_id, month, amount_cents) values ($1, $2, '2026-10-01', 100)", [a.house, foreignCat])));
    expect(m3).toMatch(/foreign key/i);
  });

  it("apagar categoria/pessoa zera a referência sem perder o lançamento", async () => {
    const a = await db.householdFor("A");
    const cat = await db.categoryId(a.user, "Compras");
    await db.as(a.user, async (c) => {
      await c.query(`insert into transactions (household_id, kind, description, amount_cents, due_date, category_id)
                     values ($1, 'expense', 'Item', 500, '2026-10-01', $2)`, [a.house, cat]);
      await c.query("delete from categories where id = $1", [cat]);
      const { rows } = await c.query<{ category_id: string | null; household_id: string }>("select category_id, household_id from transactions");
      expect(rows[0].category_id).toBeNull();
      expect(rows[0].household_id).toBe(a.house); // household_id preservado (SET NULL só na coluna da referência)
    });
  });
});

describe("restrições de escrita em tabelas sensíveis", () => {
  it("membro edita só o nome da casa — não o código de convite", async () => {
    const a = await db.householdFor("Casa antiga");
    await db.as(a.user, (c) => c.query("update households set name = 'Casa nova'"));
    expect((await db.admin<{ name: string }>("select name from households where id = $1", [a.house]))[0].name).toBe("Casa nova");

    const msg = await db.as(a.user, (c) => c.fails(() => c.query("update households set invite_code = 'abc'")));
    expect(msg).toMatch(/permission denied/i);
  });

  it("não é possível mexer em household_members direto", async () => {
    const a = await db.householdFor("A");
    const intruder = await db.createUser();
    const ins = await db.as(intruder, (c) =>
      c.fails(() => c.query("insert into household_members (household_id, user_id) values ($1, $2)", [a.house, intruder])));
    expect(ins).toMatch(/permission denied/i);
    const upd = await db.as(a.user, (c) => c.fails(() => c.query("update household_members set role = 'owner'")));
    expect(upd).toMatch(/permission denied/i);
  });

  it("um usuário só pode pertencer a uma casa", async () => {
    const a = await db.householdFor("A");
    const msg = await db.as(a.user, (c) => c.fails(() => c.rpc("create_household", { p_name: "Outra", p_person: "Eu" })));
    expect(msg).toMatch(/já participa/i);
  });

  it("create_household cria categorias, contas e pessoa padrão", async () => {
    const a = await db.householdFor("A", "Gabriel");
    await db.as(a.user, async (c) => {
      const count = async (t: string) => Number((await c.query<{ n: number }>(`select count(*)::int n from ${t}`)).rows[0].n);
      expect(await count("categories")).toBe(20);
      expect(await count("accounts")).toBe(3);
      expect((await c.query<{ name: string }>("select name from people")).rows).toEqual([{ name: "Gabriel" }]);
      expect((await c.query("select 1 from categories where is_savings")).rows).toHaveLength(1);
    });
  });

  it("valida dados: valor negativo, cor inválida e nome duplicado são rejeitados", async () => {
    const a = await db.householdFor("A");
    await db.as(a.user, async (c) => {
      expect(await c.fails(() => c.query(insertTx(a.house).replace("1000", "-5")))).toMatch(/check constraint/i);
      expect(await c.fails(() => c.query("insert into people (household_id, name, color) values ($1, 'Z', 'red')", [a.house]))).toMatch(/check constraint/i);
      expect(await c.fails(() => c.query("insert into people (household_id, name) values ($1, ' eu ')", [a.house]))).toMatch(/duplicate key/i);
    });
  });
});
