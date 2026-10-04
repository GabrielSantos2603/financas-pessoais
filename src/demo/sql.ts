/**
 * Traduz o "plano de consulta" enviado pelo adaptador do navegador em SQL parametrizado.
 * Só aceita identificadores simples e um conjunto fixo de operações/tabelas, então a entrada
 * do cliente nunca vira SQL arbitrário.
 */
export type Filter = { col: string; op: "eq" | "gte" | "lte"; val: unknown };
export type QueryPlan = {
  kind: "query";
  table: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  filters: Filter[];
  orders: { col: string; asc: boolean }[];
  range?: [number, number];
  payload?: unknown;
  onConflict?: string;
};
export type RpcPlan = { kind: "rpc"; fn: string; args: Record<string, unknown> };
export type Plan = QueryPlan | RpcPlan;

const IDENT = /^[a-z_][a-z0-9_]*$/;
const TABLES = new Set(["people", "accounts", "categories", "recurring_rules", "transactions", "budgets", "households", "household_members"]);
const OPS = { eq: "=", gte: ">=", lte: "<=" } as const;

const ident = (s: string) => {
  if (!IDENT.test(s)) throw new Error(`Identificador inválido: ${s}`);
  return `"${s}"`;
};
/** objetos/arrays viram JSON (colunas jsonb/parâmetros jsonb); o resto vai como está */
const param = (v: unknown) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);

export function buildSql(plan: Plan): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const bind = (v: unknown) => { params.push(param(v)); return `$${params.length}`; };

  if (plan.kind === "rpc") {
    const keys = Object.keys(plan.args);
    const call = keys.map((k) => `${ident(k)} => ${bind(plan.args[k])}`).join(", ");
    return { sql: `select * from public.${ident(plan.fn)}(${call})`, params };
  }

  if (!TABLES.has(plan.table)) throw new Error(`Tabela não permitida: ${plan.table}`);
  const table = `public.${ident(plan.table)}`;
  const where = plan.filters.length
    ? ` where ${plan.filters.map((f) => `${ident(f.col)} ${OPS[f.op]} ${bind(f.val)}`).join(" and ")}`
    : "";

  switch (plan.action) {
    case "select": {
      const order = plan.orders.length ? ` order by ${plan.orders.map((o) => `${ident(o.col)} ${o.asc ? "asc" : "desc"}`).join(", ")}` : "";
      const [from, to] = plan.range ?? [];
      const page = from !== undefined && to !== undefined ? ` limit ${Number(to - from + 1) | 0} offset ${Number(from) | 0}` : "";
      return { sql: `select * from ${table}${where}${order}${page}`, params };
    }
    case "insert":
    case "upsert": {
      const rows = (Array.isArray(plan.payload) ? plan.payload : [plan.payload]) as Record<string, unknown>[];
      if (!rows.length) throw new Error("Nada para inserir");
      const cols = Object.keys(rows[0]);
      const values = rows.map((r) => `(${cols.map((c) => bind(r[c] ?? null)).join(", ")})`).join(", ");
      let sql = `insert into ${table} (${cols.map(ident).join(", ")}) values ${values}`;
      if (plan.action === "upsert") {
        const target = (plan.onConflict ?? "").split(",").map((c) => c.trim()).filter(Boolean);
        const updates = cols.filter((c) => !target.includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`);
        sql += ` on conflict (${target.map(ident).join(", ")}) do update set ${updates.join(", ")}`;
      }
      return { sql, params };
    }
    case "update": {
      const row = plan.payload as Record<string, unknown>;
      const sets = Object.keys(row).map((c) => `${ident(c)} = ${bind(row[c])}`);
      if (!sets.length) throw new Error("Nada para atualizar");
      return { sql: `update ${table} set ${sets.join(", ")}${where}`, params };
    }
    case "delete":
      return { sql: `delete from ${table}${where}`, params };
  }
}
