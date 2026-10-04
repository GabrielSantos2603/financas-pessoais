import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

const codeOf = async (house: string) => (await db.admin<{ invite_code: string }>("select invite_code from households where id = $1", [house]))[0].invite_code;

describe("convite", () => {
  it("o código tem 20 caracteres hex e é único por casa", async () => {
    const a = await db.householdFor();
    const b = await db.householdFor();
    expect(await codeOf(a.house)).toMatch(/^[0-9a-f]{20}$/);
    expect(await codeOf(a.house)).not.toBe(await codeOf(b.house));
  });

  it("entra com o código (aceita maiúsculas e espaços) e passa a ver os mesmos dados", async () => {
    const owner = await db.householdFor("Casal");
    const code = await codeOf(owner.house);
    await db.as(owner.user, (c) => c.query(`insert into transactions (household_id, kind, description, amount_cents, due_date)
                                            values ($1, 'income', 'Salário', 100000, '2026-10-05')`, [owner.house]));
    const guest = await db.createUser("convidada@test.dev");
    const joined = await db.as(guest, (c) => c.rpc<string>("join_household", { p_code: `  ${code.toUpperCase()} ` }));
    expect(joined).toBe(owner.house);

    await db.as(guest, async (c) => {
      expect((await c.query("select * from transactions")).rows).toHaveLength(1);
      const members = (await c.query<{ email: string; role: string }>("select email, role from household_members order by role")).rows;
      expect(members.map((m) => m.role)).toEqual(["owner", "member"]);
      expect(members[1].email).toBe("convidada@test.dev");
    });
  });

  it("código inválido retorna NULL e bloqueia após 5 tentativas", async () => {
    const owner = await db.householdFor();
    const code = await codeOf(owner.house);
    const guest = await db.createUser();
    await db.as(guest, async (c) => {
      for (let i = 0; i < 5; i++) expect(await c.rpc("join_household", { p_code: `errado${i}` })).toBeNull();
      // mesmo o código CORRETO fica bloqueado durante a janela (impede força bruta)
      expect(await c.fails(() => c.rpc("join_household", { p_code: code }))).toMatch(/muitas tentativas/i);
    });
    // após a janela de 15 minutos volta a funcionar
    await db.admin("update join_attempts set attempted_at = now() - interval '16 minutes' where user_id = $1", [guest]);
    expect(await db.as(guest, (c) => c.rpc("join_household", { p_code: code }))).toBe(owner.house);
  });

  it("não deixa quem já tem casa entrar em outra", async () => {
    const a = await db.householdFor();
    const b = await db.householdFor();
    const msg = await db.as(a.user, (c) => c.fails(() => c.rpc("join_household", { p_code: "qualquer" })));
    expect(msg).toMatch(/já participa/i);
    expect(b.house).not.toBe(a.house);
  });

  it("trocar o código invalida o antigo; só o dono troca", async () => {
    const owner = await db.householdFor();
    const old = await codeOf(owner.house);
    const guest = await db.createUser();
    await db.as(guest, (c) => c.rpc("join_household", { p_code: old }));

    expect(await db.as(guest, (c) => c.fails(() => c.rpc("rotate_invite_code")))).toMatch(/somente o dono/i);

    const fresh = await db.as(owner.user, (c) => c.rpc<string>("rotate_invite_code"));
    expect(fresh).toMatch(/^[0-9a-f]{20}$/);
    expect(fresh).not.toBe(old);

    const late = await db.createUser();
    expect(await db.as(late, (c) => c.rpc("join_household", { p_code: old }))).toBeNull();
    expect(await db.as(late, (c) => c.rpc("join_household", { p_code: fresh }))).toBe(owner.house);
  });
});

describe("remover membro / sair", () => {
  it("só o dono remove membros; não remove a si mesmo", async () => {
    const owner = await db.householdFor();
    const guest = await db.createUser();
    const code = await codeOf(owner.house);
    await db.as(guest, (c) => c.rpc("join_household", { p_code: code }));

    expect(await db.as(guest, (c) => c.fails(() => c.rpc("remove_member", { p_user: owner.user })))).toMatch(/somente o dono/i);
    expect(await db.as(owner.user, (c) => c.fails(() => c.rpc("remove_member", { p_user: owner.user })))).toMatch(/sair do espaço/i);

    await db.as(owner.user, (c) => c.rpc("remove_member", { p_user: guest }));
    expect(await db.as(guest, async (c) => (await c.query("select * from household_members")).rows)).toHaveLength(0);
  });

  it("dono não sai com outros membros; ao sair sozinho apaga a casa e os dados", async () => {
    const owner = await db.householdFor();
    const code = await codeOf(owner.house);
    const guest = await db.createUser();
    await db.as(guest, (c) => c.rpc("join_household", { p_code: code }));

    expect(await db.as(owner.user, (c) => c.fails(() => c.rpc("leave_household")))).toMatch(/não pode sair/i);

    await db.as(guest, (c) => c.rpc("leave_household"));
    await db.as(owner.user, (c) => c.query(`insert into transactions (household_id, kind, description, amount_cents, due_date)
                                            values ($1, 'expense', 'x', 100, '2026-10-01')`, [owner.house]));
    await db.as(owner.user, (c) => c.rpc("leave_household"));

    expect(await db.admin("select 1 from households where id = $1", [owner.house])).toHaveLength(0);
    expect(await db.admin("select 1 from transactions where household_id = $1", [owner.house])).toHaveLength(0);
  });
});
