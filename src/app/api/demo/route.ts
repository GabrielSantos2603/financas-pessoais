import { NextResponse } from "next/server";
import { isDemo } from "@/lib/demo";
import { buildSql, type Plan } from "@/demo/sql";

export const dynamic = "force-dynamic";

/** Endpoint do modo demonstração (somente `npm run dev:demo`). Fora dele responde 404. */
export async function POST(request: Request) {
  if (!isDemo) return new NextResponse("Not found", { status: 404 });

  const plan = (await request.json()) as Plan;
  try {
    const { getDemoDb } = await import("@/demo/server-db");
    const demo = await getDemoDb();
    const { sql, params } = buildSql(plan);
    const rows = await demo.run((q) => q(sql, params));

    if (plan.kind === "rpc") {
      // Escalares chegam como { <nome_da_função>: valor }; funções de tabela devolvem várias colunas.
      const scalar = rows.length === 1 && plan.fn in rows[0];
      return NextResponse.json({ data: scalar ? rows[0][plan.fn] : rows, error: null });
    }
    return NextResponse.json({ data: plan.action === "select" ? rows : null, error: null });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return NextResponse.json({ data: null, error: { message: err.message ?? "Erro", code: err.code } });
  }
}
