"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { useMonth } from "@/hooks/use-month";
import { useCategoryTotals, usePeriodSummary, usePersonTotals, useRefs } from "@/hooks/queries";
import { CategoryBadge } from "@/components/finance/category-badge";
import { PageHeader } from "@/components/layout/page-header";
import { usePrivacy } from "@/components/privacy";
import { Money } from "@/components/ui/money";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/fields";
import { monthFirstDay, monthLabel, monthRange, monthShort, shiftMonth } from "@/lib/dates";
import { money, moneyCompact, pct } from "@/lib/format";
import { percentOf } from "@/domain/money";
import { summaryFromRow, sumSummaries } from "@/domain/summary";
import { cn } from "@/lib/cn";

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12, color: "var(--fg)", boxShadow: "0 10px 30px -10px rgb(0 0 0 / .3)" } as const;

export default function RelatoriosPage() {
  const { month, setMonth } = useMonth();
  const [span, setSpan] = useState<"3" | "6" | "12">("6");
  const n = Number(span);
  const refs = useRefs();
  const { hidden } = usePrivacy();

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
  const fmt = (v: unknown) => (hidden ? "••••" : money(Number(v)));

  return (
    <div className="pb-4">
      <PageHeader title="Relatórios" subtitle={`${monthLabel(firstMonth)} → ${monthLabel(month)}`} month={{ value: month, onChange: setMonth }} />

      <div className="mt-4 space-y-5 md:mt-0 md:space-y-6">
        <Segmented value={span} onChange={setSpan} className="md:w-80" options={[{ value: "3", label: "3 meses" }, { value: "6", label: "6 meses" }, { value: "12", label: "12 meses" }]} />

        {isLoading ? <Skeleton className="h-64 rounded-[22px]" /> : empty ? (
          <Card><EmptyState icon={<BarChart3 className="size-6" />} title="Sem dados no período" hint="Adicione lançamentos ou importe sua planilha em Configurações." /></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Receitas" tone="income"><Money cents={total.income} /></Kpi>
              <Kpi label="Despesas" tone="expense"><Money cents={total.expense} /></Kpi>
              <Kpi label="Média de gasto / mês"><Money cents={avgExpense} /></Kpi>
              <Kpi label="Taxa de poupança" tone={savingRate >= 10 ? "income" : undefined} hint="% da receita que sobrou ou foi guardada">{pct(savingRate)}</Kpi>
            </div>

            <Card>
              <CardHeader title="Receitas × Despesas" />
              <div className="h-64 px-2 pb-3 pt-4 md:px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} barGap={3} barCategoryGap="22%">
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} width={56} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => (hidden ? "" : moneyCompact(Number(v)))} />
                    <Tooltip cursor={{ fill: "var(--surface-2)", radius: 8 }} formatter={fmt} contentStyle={tooltipStyle} />
                    <Bar dataKey="Receitas" fill="var(--income)" radius={[7, 7, 3, 3]} />
                    <Bar dataKey="Despesas" fill="var(--expense)" radius={[7, 7, 3, 3]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Sobra mensal" />
              <div className="h-44 px-2 pb-3 pt-4 md:px-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rows}>
                    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--brand)" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                    <Tooltip formatter={fmt} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="Sobra" stroke="var(--brand)" strokeWidth={3} fill="url(#g)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid gap-5 md:gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Onde o dinheiro foi" />
                <ul className="space-y-4 p-4 md:p-5">
                  {ranking.length === 0 && <li className="text-sm text-muted">Sem despesas no período.</li>}
                  {ranking.map(({ id, value, c }) => (
                    <li key={id} className="flex items-center gap-3">
                      <CategoryBadge icon={c?.icon} color={c?.color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-semibold">{c?.name ?? "Sem categoria"}</span>
                          <span className="shrink-0"><Money cents={value} className="font-semibold" /> <span className="text-xs text-muted">· {pct(percentOf(value, total.expense))}</span></span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="grow-x h-full rounded-full" style={{ width: `${percentOf(value, top)}%`, background: c?.color ?? "#94a3b8" }} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
              <div className="space-y-5 md:space-y-6">
                <Card>
                  <CardHeader title="Por pessoa" />
                  <ul className="space-y-4 p-4 md:p-5">
                    {persons.length === 0 && <li className="text-sm text-muted">Sem despesas no período.</li>}
                    {persons.map(({ id, value, p }) => (
                      <li key={id} className="flex items-center gap-3 text-sm">
                        <span className="grid size-10 place-items-center rounded-full font-bold text-white" style={{ background: p?.color ?? "#94a3b8" }}>{(p?.name ?? "?").slice(0, 1).toUpperCase()}</span>
                        <span className="flex-1 font-semibold">{p?.name ?? "Sem pessoa"}</span>
                        <Money cents={value} className="font-semibold" />
                        <span className="tnum w-11 text-right text-xs text-muted">{pct(percentOf(value, total.expense))}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card className="overflow-x-auto">
                  <CardHeader title="Resumo por mês" />
                  <table className="tnum mt-2 w-full min-w-[420px] text-sm">
                    <thead><tr className="text-left text-xs text-muted"><th className="px-4 py-2 font-medium md:px-5">Mês</th><th className="px-2 font-medium">Receitas</th><th className="px-2 font-medium">Despesas</th><th className="px-4 text-right font-medium md:px-5">Sobra</th></tr></thead>
                    <tbody className="divide-y divide-border/70">
                      {[...rows].reverse().map((r) => (
                        <tr key={r.key}>
                          <td className="px-4 py-2.5 font-medium capitalize md:px-5">{r.label}</td>
                          <td className="px-2 text-income"><Money cents={r.income} /></td>
                          <td className="px-2"><Money cents={r.expense + r.saved} /></td>
                          <td className={cn("px-4 text-right font-bold md:px-5", r.balance < 0 && "text-expense")}><Money cents={r.balance} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, tone, hint, children }: { label: string; tone?: "income" | "expense"; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4" title={hint}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tracking-tight md:text-2xl", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{children}</p>
    </Card>
  );
}
