"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { useMonth } from "@/hooks/use-month";
import { useCategoryTotals, usePeriodSummary, usePersonTotals, useRefs } from "@/hooks/queries";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/fields";
import { monthFirstDay, monthLabel, monthRange, monthShort, shiftMonth } from "@/lib/dates";
import { money, moneyCompact, pct } from "@/lib/format";
import { percentOf } from "@/domain/money";
import { summaryFromRow, sumSummaries } from "@/domain/summary";
import { cn } from "@/lib/cn";

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--fg)" } as const;

export default function RelatoriosPage() {
  const { month, setMonth } = useMonth();
  const [span, setSpan] = useState<"3" | "6" | "12">("6");
  const n = Number(span);
  const refs = useRefs();

  const firstMonth = shiftMonth(month, -(n - 1));
  const from = monthFirstDay(firstMonth);
  const to = monthRange(month).to;
  const summaryQ = usePeriodSummary(from, to);
  const categoriesQ = useCategoryTotals(from, to);
  const peopleQ = usePersonTotals(from, to);

  const rows = useMemo(
    () => (summaryQ.data ?? []).map((r) => {
      const s = summaryFromRow(r);
      const key = r.month.slice(0, 7);
      return { key, label: monthShort(key), ...s, Receitas: s.income, Despesas: s.expense, Sobra: s.balance };
    }),
    [summaryQ.data],
  );
  const total = useMemo(() => sumSummaries(rows), [rows]);
  const avgExpense = Math.round(total.expense / n);
  const savingRate = percentOf(total.income - total.expense, total.income); // sobra + guardado, sobre a receita

  const ranking = useMemo(
    () => (categoriesQ.data ?? []).map((r) => ({ id: r.category_id ?? "none", value: r.total_cents, c: r.category_id ? refs.categoryById.get(r.category_id) : undefined })),
    [categoriesQ.data, refs.categoryById],
  );
  const top = ranking[0]?.value || 1;
  const persons = useMemo(
    () => (peopleQ.data ?? []).map((r) => ({ id: r.person_id ?? "none", value: r.total_cents, p: r.person_id ? refs.personById.get(r.person_id) : undefined })),
    [peopleQ.data, refs.personById],
  );

  const isLoading = summaryQ.isLoading;
  const empty = !isLoading && total.income + total.expense + total.saved === 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold md:text-2xl">Relatórios</h1>
        <MonthSwitcher month={month} onChange={setMonth} />
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{monthLabel(firstMonth)} → {monthLabel(month)}</p>
        <Segmented value={span} onChange={setSpan} className="w-64" options={[{ value: "3", label: "3 meses" }, { value: "6", label: "6 meses" }, { value: "12", label: "12 meses" }]} />
      </div>

      {isLoading ? <Skeleton className="h-64" /> : empty ? (
        <Card><EmptyState icon={<BarChart3 className="size-6" />} title="Sem dados no período" hint="Adicione lançamentos ou importe sua planilha em Configurações." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Receitas" value={money(total.income)} tone="income" />
            <Kpi label="Despesas" value={money(total.expense)} tone="expense" />
            <Kpi label="Média de gasto / mês" value={money(avgExpense)} />
            <Kpi label="Taxa de poupança" value={pct(savingRate)} tone={savingRate >= 10 ? "income" : undefined} hint="% da receita que sobrou ou foi guardada" />
          </div>

          <Card>
            <CardHeader title="Receitas × Despesas" />
            <div className="h-64 px-2 pb-3 pt-3 md:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} barGap={4}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} width={56} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => moneyCompact(Number(v))} />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} />
                  <Bar dataKey="Receitas" fill="var(--income)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Despesas" fill="var(--expense)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Sobra mensal" />
            <div className="h-44 px-2 pb-3 pt-3 md:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--brand)" stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="Sobra" stroke="var(--brand)" strokeWidth={2.5} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Onde o dinheiro foi" />
              <ul className="space-y-3 p-4 md:p-5">
                {ranking.length === 0 && <li className="text-sm text-muted">Sem despesas no período.</li>}
                {ranking.map(({ id, value, c }) => (
                  <li key={id}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{c?.name ?? "Sem categoria"}</span><span className="tnum">{money(value)} <span className="text-muted">· {pct(percentOf(value, total.expense))}</span></span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${percentOf(value, top)}%`, background: c?.color ?? "#94a3b8" }} /></div>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="space-y-4 md:space-y-6">
              <Card>
                <CardHeader title="Por pessoa" />
                <ul className="space-y-3 p-4 md:p-5">
                  {persons.length === 0 && <li className="text-sm text-muted">Sem despesas no período.</li>}
                  {persons.map(({ id, value, p }) => (
                    <li key={id} className="flex items-center gap-3 text-sm">
                      <span className="size-3 rounded-full" style={{ background: p?.color ?? "#94a3b8" }} />
                      <span className="flex-1 font-medium">{p?.name ?? "Sem pessoa"}</span>
                      <span className="tnum">{money(value)}</span>
                      <span className="tnum w-12 text-right text-muted">{pct(percentOf(value, total.expense))}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="overflow-x-auto">
                <CardHeader title="Resumo por mês" />
                <table className="tnum mt-2 w-full min-w-[420px] text-sm">
                  <thead><tr className="text-left text-xs text-muted"><th className="px-4 py-2 font-medium">Mês</th><th className="px-2 font-medium">Receitas</th><th className="px-2 font-medium">Despesas</th><th className="px-4 text-right font-medium">Sobra</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {[...rows].reverse().map((r) => (
                      <tr key={r.key}><td className="px-4 py-2 capitalize">{r.label}</td><td className="px-2 text-income">{money(r.income)}</td><td className="px-2">{money(r.expense + r.saved)}</td><td className={cn("px-4 text-right font-semibold", r.balance < 0 ? "text-expense" : "")}>{money(r.balance)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: "income" | "expense"; hint?: string }) {
  return (
    <Card className="p-4" title={hint}>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("tnum mt-1 text-xl font-bold md:text-2xl", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{value}</p>
    </Card>
  );
}
