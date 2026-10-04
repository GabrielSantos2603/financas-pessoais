import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { planInstallments } from "@/domain/installments";
import { savingsSet, summarize, summaryFromRow } from "@/domain/summary";
import type { Category, PeriodSummaryRow, Transaction } from "@/types/db";
import { generateDatabaseTypes } from "../../scripts/gen-db-types";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

/** Regras escritas em TypeScript e em SQL precisam concordar. Estes testes comparam as duas. */
describe("TypeScript ⇄ SQL", () => {
  it("planInstallments (TS) == create_installments (SQL) para valores/cenários difíceis", async () => {
    const { user } = await db.householdFor();
    const cases: { cents: number; isTotal: boolean; total: number; current: number }[] = [
      { cents: 100000, isTotal: true, total: 3, current: 1 },
      { cents: 100, isTotal: true, total: 3, current: 2 },
      { cents: 99999, isTotal: true, total: 7, current: 1 },
      { cents: 1, isTotal: true, total: 2, current: 1 },
      { cents: 47700, isTotal: false, total: 10, current: 8 },
      { cents: 12345, isTotal: false, total: 12, current: 12 },
      { cents: 5_000_001, isTotal: true, total: 120, current: 100 },
    ];
    for (const c of cases) {
      const ts = planInstallments({ amountCents: c.cents, amountIsTotal: c.isTotal, total: c.total, current: c.current }).amounts;
      const gid = await db.as(user, (cl) => cl.rpc<string>("create_installments", {
        p_kind: "expense", p_description: "x", p_amount_cents: c.cents, p_amount_is_total: c.isTotal,
        p_first_due: "2026-10-20", p_total: c.total, p_current: c.current, p_person_id: null, p_category_id: null,
        p_account_id: null, p_notes: null, p_first_done: false, p_today: "2026-10-04",
      }));
      const sql = await db.as(user, async (cl) =>
        (await cl.query<{ a: number }>("select amount_cents::int a from transactions where installment_group = $1 order by installment_number", [gid])).rows.map((r) => r.a));
      expect(sql, JSON.stringify(c)).toEqual(ts);
    }
  });

  it("summarize (TS) == period_summary (SQL) num conjunto aleatório de lançamentos", async () => {
    const { user, house } = await db.householdFor();
    const cats = await db.as(user, async (c) => (await c.query<Category>("select * from categories")).rows);
    const savings = savingsSet(cats);

    // PRNG determinístico
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

    await db.as(user, async (c) => {
      for (let i = 0; i < 300; i++) {
        const kind = rnd() < 0.3 ? "income" : "expense";
        const pool = cats.filter((x) => x.kind === kind);
        const cat = rnd() < 0.15 ? null : pool[Math.floor(rnd() * pool.length)].id;
        const day = 1 + Math.floor(rnd() * 28);
        await c.query(
          `insert into transactions (household_id, kind, description, amount_cents, due_date, status, category_id)
           values ($1, $2, 'x', $3, make_date(2026, $4, $5), $6, $7)`,
          [house, kind, 1 + Math.floor(rnd() * 500000), 1 + Math.floor(rnd() * 3), day, rnd() < 0.5 ? "done" : "pending", cat],
        );
      }
    });

    for (const month of [1, 2, 3]) {
      const txs = await db.as(user, async (c) =>
        (await c.query<Transaction>("select *, amount_cents::int as amount_cents from transactions where extract(month from due_date) = $1", [month])).rows);
      const ts = summarize(txs, savings);

      const row = await db.as(user, async (c) =>
        (await c.query<PeriodSummaryRow>(
          `select month::text, income_cents::int, income_done_cents::int, expense_cents::int, expense_done_cents::int,
                  saved_cents::int, saved_done_cents::int
           from period_summary(make_date(2026, $1, 1), make_date(2026, $1, 1))`, [month])).rows[0]);
      expect(summaryFromRow(row)).toEqual(ts);
    }
  });
});

describe("tipos gerados", () => {
  it("src/types/database.ts está em dia com as migrations (rode `npm run db:types` se falhar)", async () => {
    const committed = readFileSync("src/types/database.ts", "utf8").replace(/\r\n/g, "\n");
    expect(committed).toBe(await generateDatabaseTypes());
  });
});
