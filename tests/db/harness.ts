import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** Reproduz o que o Supabase fornece antes das nossas migrations (roles, schema auth, privilégios padrão). */
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables    to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

export type Role = "authenticated" | "anon";

export class TestDb {
  constructor(readonly pg: PGlite) {}

  /** Cria um usuário em auth.users (como superusuário) e devolve o id. */
  async createUser(email = `u${Math.random().toString(36).slice(2)}@test.dev`) {
    const { rows } = await this.pg.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
    return rows[0].id;
  }

  /** Executa `fn` com o papel/claims de um usuário do Supabase (RLS valendo). */
  async as<T>(userId: string | null, fn: (c: Client) => Promise<T>, role: Role = "authenticated"): Promise<T> {
    await this.pg.exec(`set role ${role}`);
    await this.pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    try {
      return await fn(new Client(this.pg));
    } finally {
      await this.pg.exec("reset role");
      await this.pg.query("select set_config('request.jwt.claim.sub', '', false)");
    }
  }

  /** Superusuário (ignora RLS) — para preparar/inspecionar dados. */
  async admin<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return (await this.pg.query<T>(sql, params)).rows;
  }

  /** Cria usuário + casa já com categorias padrão. */
  async householdFor(name = "Casa", person = "Eu") {
    const user = await this.createUser();
    const house = await this.as(user, (c) => c.rpc<string>("create_household", { p_name: name, p_person: person }));
    return { user, house };
  }

  async categoryId(userId: string, name: string) {
    return this.as(userId, async (c) => (await c.query<{ id: string }>("select id from categories where name = $1", [name])).rows[0]?.id);
  }
  async personId(userId: string, name: string) {
    return this.as(userId, async (c) => (await c.query<{ id: string }>("select id from people where name = $1", [name])).rows[0]?.id);
  }
}

export class Client {
  constructor(private pg: PGlite) {}

  async query<T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return this.pg.query<T>(sql, params);
  }

  /** Chama uma função do schema public com argumentos nomeados (como o PostgREST). */
  async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const keys = Object.keys(args);
    const call = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
    const params = keys.map((k) => (args[k] !== null && typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k]));
    const { rows } = await this.pg.query<Record<string, unknown>>(`select * from public.${fn}(${call})`, params);
    return (rows.length === 1 && fn in rows[0] ? rows[0][fn] : rows) as T;
  }

  /** Garante que a chamada falha e devolve a mensagem de erro. */
  async fails(fn: () => Promise<unknown>): Promise<string> {
    try {
      await fn();
    } catch (e) {
      // um erro dentro de transação aberta pode deixá-la abortada; limpa por segurança
      try { await this.pg.exec("rollback"); } catch { /* sem transação */ }
      return (e as Error).message;
    }
    throw new Error("esperava falha, mas a operação teve sucesso");
  }
}

let migrationsSql: string[] | null = null;

export async function createTestDb() {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUBS);
  migrationsSql ??= readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  for (const sql of migrationsSql) await pg.exec(sql);
  return new TestDb(pg);
}

export const d = (s: string) => s; // marca datas literais nos testes (yyyy-mm-dd)
