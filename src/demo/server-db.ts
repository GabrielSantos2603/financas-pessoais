import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, types } from "@electric-sql/pglite";
import { seedDemo, DEMO_EMAIL } from "./seed";

export interface DemoDb {
  pg: PGlite;
  userId: string;
  householdId: string;
  /** serializa as chamadas: o PGlite tem uma única conexão e usamos SET ROLE/claims por requisição */
  run<T>(fn: (q: Query) => Promise<T>): Promise<T>;
}
export type Query = <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>;

const g = globalThis as unknown as { __demoDb?: Promise<DemoDb> };

/** Singleton que sobrevive ao hot-reload do `next dev`. */
export function getDemoDb(): Promise<DemoDb> {
  return (g.__demoDb ??= createDemoDb().catch((e) => {
    g.__demoDb = undefined; // não guarda falha: a próxima requisição tenta de novo
    throw e;
  }));
}

async function createDemoDb(): Promise<DemoDb> {
  const root = process.cwd();
  const pg = new PGlite({
    parsers: {
      [types.DATE]: (v: string) => v,       // o app espera "yyyy-mm-dd", não Date
      [types.INT8]: (v: string) => Number(v), // centavos cabem com folga em number
    },
  });

  await pg.exec(readFileSync(join(root, "supabase", "local", "auth-stubs.sql"), "utf8"));
  const dir = join(root, "supabase", "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(dir, f), "utf8"));

  const { rows: [u] } = await pg.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [DEMO_EMAIL]);
  const userId = u.id;

  let chain: Promise<unknown> = Promise.resolve();
  const run = <T,>(fn: (q: Query) => Promise<T>): Promise<T> => {
    const task = chain.then(async () => {
      await pg.exec("set role authenticated");
      await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
      try {
        return await fn(async (sql, params = []) => (await pg.query(sql, params)).rows as never);
      } finally {
        await pg.exec("reset role");
      }
    });
    chain = task.catch(() => undefined);
    return task;
  };

  const householdId = await run(async (q) => {
    const [{ create_household: id }] = await q<{ create_household: string }>("select public.create_household($1, $2)", ["Casa Demo", "Lucas"]);
    await seedDemo(q, id);
    return id;
  });

  return { pg, userId, householdId, run };
}
