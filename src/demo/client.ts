/**
 * Adaptador que imita o subconjunto do cliente Supabase usado pelos serviços e encaminha as
 * chamadas para /api/demo (Postgres embutido). Só é usado no modo demonstração.
 */
import type { Db } from "@/services/db";
import type { Filter, Plan, QueryPlan } from "./sql";

type Result = { data: unknown; error: { message: string; code?: string } | null };

async function send(plan: Plan): Promise<Result> {
  try {
    const res = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(plan) });
    if (!res.ok) return { data: null, error: { message: `Modo demo indisponível (${res.status})` } };
    return (await res.json()) as Result;
  } catch (e) {
    return { data: null, error: { message: (e as Error).message } };
  }
}

class Builder implements PromiseLike<Result> {
  private plan: QueryPlan;
  constructor(table: string) {
    this.plan = { kind: "query", table, action: "select", filters: [], orders: [] };
  }
  select() { return this; } // o select inicial é o padrão; `.select()` após escrita não muda o resultado aqui
  insert(payload: unknown) { this.plan.action = "insert"; this.plan.payload = payload; return this; }
  update(payload: unknown) { this.plan.action = "update"; this.plan.payload = payload; return this; }
  upsert(payload: unknown, opts?: { onConflict?: string }) { this.plan.action = "upsert"; this.plan.payload = payload; this.plan.onConflict = opts?.onConflict; return this; }
  delete() { this.plan.action = "delete"; return this; }
  private filter(op: Filter["op"], col: string, val: unknown) { this.plan.filters.push({ col, op, val }); return this; }
  eq(col: string, val: unknown) { return this.filter("eq", col, val); }
  gte(col: string, val: unknown) { return this.filter("gte", col, val); }
  lte(col: string, val: unknown) { return this.filter("lte", col, val); }
  order(col: string, opts?: { ascending?: boolean }) { this.plan.orders.push({ col, asc: opts?.ascending ?? true }); return this; }
  range(from: number, to: number) { this.plan.range = [from, to]; return this; }
  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return send(this.plan).then(ok, no);
  }
}

export function createDemoDb(): Db {
  return {
    from: (table: string) => new Builder(table),
    rpc: (fn: string, args: Record<string, unknown> = {}) => ({
      then: <A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null) =>
        send({ kind: "rpc", fn, args }).then(ok, no),
    }),
  } as unknown as Db;
}
