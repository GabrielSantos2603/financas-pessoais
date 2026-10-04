import { describe, expect, it } from "vitest";
import { buildSql, type QueryPlan } from "@/demo/sql";

const plan = (over: Partial<QueryPlan>): QueryPlan => ({ kind: "query", table: "transactions", action: "select", filters: [], orders: [], ...over });

describe("demo/sql — tradução do plano de consulta em SQL parametrizado", () => {
  it("select com filtros, ordenação e paginação", () => {
    const { sql, params } = buildSql(plan({
      filters: [{ col: "due_date", op: "gte", val: "2026-10-01" }, { col: "due_date", op: "lte", val: "2026-10-31" }],
      orders: [{ col: "due_date", asc: true }, { col: "id", asc: false }],
      range: [1000, 1999],
    }));
    expect(sql).toBe('select * from public."transactions" where "due_date" >= $1 and "due_date" <= $2 order by "due_date" asc, "id" desc limit 1000 offset 1000');
    expect(params).toEqual(["2026-10-01", "2026-10-31"]);
  });

  it("valores NUNCA entram no texto do SQL (sempre parâmetros)", () => {
    const { sql, params } = buildSql(plan({ filters: [{ col: "id", op: "eq", val: "x'; drop table transactions; --" }] }));
    expect(sql).not.toMatch(/drop table/i);
    expect(params).toEqual(["x'; drop table transactions; --"]);
  });

  it("recusa identificadores perigosos e tabelas fora da lista", () => {
    expect(() => buildSql(plan({ filters: [{ col: 'id"; drop table x; --', op: "eq", val: 1 }] }))).toThrow(/Identificador inválido/);
    expect(() => buildSql(plan({ orders: [{ col: "id desc; --", asc: true }] }))).toThrow(/Identificador inválido/);
    expect(() => buildSql(plan({ table: "pg_shadow" }))).toThrow(/Tabela não permitida/);
    expect(() => buildSql(plan({ table: "auth.users" }))).toThrow();
    expect(() => buildSql({ kind: "rpc", fn: "x(); drop table t; --", args: {} })).toThrow(/Identificador inválido/);
    expect(() => buildSql({ kind: "rpc", fn: "ok_fn", args: { 'p_a"; --': 1 } })).toThrow(/Identificador inválido/);
  });

  it("insert (um ou vários) e objetos viram JSON", () => {
    const one = buildSql(plan({ action: "insert", table: "people", payload: { household_id: "h", name: "Ana" } }));
    expect(one.sql).toBe('insert into public."people" ("household_id", "name") values ($1, $2)');
    const many = buildSql(plan({ action: "insert", table: "budgets", payload: [{ a: 1, b: { x: 1 } }, { a: 2, b: null }] }));
    expect(many.sql).toContain("values ($1, $2), ($3, $4)");
    expect(many.params).toEqual([1, '{"x":1}', 2, null]);
  });

  it("upsert atualiza as colunas que não são a chave de conflito", () => {
    const { sql } = buildSql(plan({ action: "upsert", table: "budgets", payload: { category_id: "c", month: "2026-10-01", amount_cents: 5 }, onConflict: "category_id,month" }));
    expect(sql).toContain('on conflict ("category_id", "month") do update set "amount_cents" = excluded."amount_cents"');
  });

  it("update e delete respeitam os filtros", () => {
    const up = buildSql(plan({ action: "update", payload: { status: "done", settled_at: null }, filters: [{ col: "id", op: "eq", val: "t1" }] }));
    expect(up.sql).toBe('update public."transactions" set "status" = $2, "settled_at" = $3 where "id" = $1');
    expect(up.params).toEqual(["t1", "done", null]); // os parâmetros do filtro são numerados primeiro
    expect(buildSql(plan({ action: "delete", filters: [{ col: "id", op: "eq", val: "t1" }] })).sql).toBe('delete from public."transactions" where "id" = $1');
  });

  it("rpc usa argumentos nomeados e serializa arrays/objetos como JSON", () => {
    const { sql, params } = buildSql({ kind: "rpc", fn: "import_transactions", args: { p_rows: [{ a: 1 }], p_x: "y" } });
    expect(sql).toBe('select * from public."import_transactions"("p_rows" => $1, "p_x" => $2)');
    expect(params).toEqual(['[{"a":1}]', "y"]);
  });
});
