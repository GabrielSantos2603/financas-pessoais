"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, PiggyBank, Wallet } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useMonth } from "@/hooks/use-month";
import {
  useCategoryTotals, useInstallmentGroups, useMaterializeRecurring, useMonthTransactions,
  usePeriodSummary, usePersonTotals, useRefs,
} from "@/hooks/queries";
import { useToggleStatus } from "@/hooks/mutations";
import { useTxSheet } from "@/components/finance/tx-sheet";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { TxRow } from "@/components/finance/tx-row";
import { Card, CardHeader, EmptyState, Progress, Skeleton } from "@/components/ui/card";
import { monthFirstDay, monthRange, monthShort, shiftMonth, today } from "@/lib/dates";
import { money, moneyCompact, pct } from "@/lib/format";
import { percentOf, sumCents } from "@/domain/money";
import { summaryFromRow, type Summary } from "@/domain/summary";
import { cn } from "@/lib/cn";

const EMPTY: Summary = {
  income: 0, incomeDone: 0, incomePending: 0, expense: 0, expenseDone: 0, expensePending: 0,
  saved: 0, savedDone: 0, balance: 0, cash: 0,
};

export default function DashboardPage() {
  const { month, setMonth } = useMonth();
  const refs = useRefs();
  const { open } = useTxSheet();
  const toggle = useToggleStatus();
  useMaterializeRecurring(month);

  const { from, to } = monthRange(month);
  const summaryQ = usePeriodSummary(monthFirstDay(shiftMonth(month, -5)), to); // 6 meses, agregado no banco
  const categoriesQ = useCategoryTotals(from, to);
  const peopleQ = usePersonTotals(from, to);
  const txQ = useMonthTransactions(month);
  const installmentsQ = useInstallmentGroups();
  const isLoading = summaryQ.isLoading;

  const trend = useMemo(
    () => (summaryQ.data ?? []).map((r) => ({ key: r.month.slice(0, 7), label: monthShort(r.month.slice(0, 7)), ...summaryFromRow(r) })),
    [summaryQ.data],
  );
  const s = trend.find((t) => t.key === month) ?? EMPTY;
  const chart = trend.map((t) => ({ label: t.label, Receitas: t.income, Despesas: t.expense + t.saved }));

  const byCategory = useMemo(
    () => (categoriesQ.data ?? []).map((r) => {
      const c = r.category_id ? refs.categoryById.get(r.category_id) : undefined;
      return { id: r.category_id ?? "none", name: c?.name ?? "Sem categoria", color: c?.color ?? "#94a3b8", value: r.total_cents };
    }),
    [categoriesQ.data, refs.categoryById],
  );
  const byPerson = useMemo(
    () => (peopleQ.data ?? []).map((r) => {
      const p = r.person_id ? refs.personById.get(r.person_id) : undefined;
      return { id: r.person_id ?? "none", name: p?.name ?? "Sem pessoa", color: p?.color ?? "#94a3b8", value: r.total_cents };
    }),
    [peopleQ.data, refs.personById],
  );

  const monthTx = useMemo(() => txQ.data ?? [], [txQ.data]);
  const upcoming = useMemo(
    () => monthTx.filter((t) => t.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6),
    [monthTx],
  );
  const overdueCount = monthTx.filter((t) => t.status === "pending" && t.due_date < today()).length;
  const openGroups = (installmentsQ.data ?? []).filter((g) => g.pending_count > 0);
  const installmentsTotal = sumCents(openGroups.map((g) => g.remaining_cents));

  const negative = s.balance < 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Visão geral</h1>
          <p className="hidden text-sm text-muted md:block">Como está o seu mês</p>
        </div>
        <MonthSwitcher month={month} onChange={setMonth} />
      </header>

      {/* Saldo do mês */}
      <Card className={cn("overflow-hidden border-0 text-white", negative ? "bg-gradient-to-br from-rose-600 to-rose-800" : "bg-gradient-to-br from-indigo-600 to-violet-700")}>
        <div className="p-5 md:p-6">
          <p className="text-sm font-medium text-white/80">Sobra prevista do mês</p>
          {isLoading ? <Skeleton className="mt-2 h-10 w-48 bg-white/20" /> : (
            <p className="tnum mt-1 text-4xl font-bold tracking-tight md:text-5xl">{money(s.balance)}</p>
          )}
          <p className="mt-1 text-sm text-white/75">
            {negative ? "As despesas previstas superam as receitas deste mês." : "Receitas − despesas − valor guardado."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/15 pt-4 text-sm">
            <div>
              <p className="text-white/70">Em caixa agora</p>
              <p className="tnum text-lg font-semibold">{money(s.cash)}</p>
              <p className="text-xs text-white/60">recebido − pago</p>
            </div>
            <div>
              <p className="text-white/70">Ainda a pagar</p>
              <p className="tnum text-lg font-semibold">{money(s.expensePending)}</p>
              <p className="text-xs text-white/60">a receber {money(s.incomePending)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Receitas / Despesas / Guardado */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={<ArrowUpCircle className="size-5" />} tone="income" label="Receitas" total={s.income} done={s.incomeDone} doneLabel="recebido" loading={isLoading} />
        <StatCard icon={<ArrowDownCircle className="size-5" />} tone="expense" label="Despesas" total={s.expense} done={s.expenseDone} doneLabel="pago" loading={isLoading} />
        <StatCard icon={<PiggyBank className="size-5" />} tone="brand" label="Guardado" total={s.saved} done={s.savedDone} doneLabel="guardado" loading={isLoading} />
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
        {/* Próximos vencimentos */}
        <Card className="lg:col-span-3">
          <CardHeader
            title={<span className="flex items-center gap-2"><CalendarClock className="size-4" /> Pendentes do mês</span>}
            action={<Link href={`/lancamentos?m=${month}`} className="text-sm font-medium text-brand hover:underline">Ver todos</Link>}
          />
          {overdueCount > 0 && (
            <p className="mx-4 mt-3 rounded-lg bg-expense-soft px-3 py-2 text-sm font-medium text-expense md:mx-5">
              {overdueCount} {overdueCount === 1 ? "lançamento atrasado" : "lançamentos atrasados"}
            </p>
          )}
          <div className="mt-2 divide-y divide-border pb-2">
            {txQ.isLoading && <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
            {!txQ.isLoading && upcoming.length === 0 && (
              <EmptyState icon={<Wallet className="size-6" />} title="Tudo em dia 🎉" hint="Nada pendente neste mês. Adicione um lançamento quando precisar." />
            )}
            {upcoming.map((t) => (
              <TxRow key={t.id} tx={t} showDate category={t.category_id ? refs.categoryById.get(t.category_id) : undefined} person={t.person_id ? refs.personById.get(t.person_id) : undefined} onOpen={(x) => open({ tx: x })} onToggle={toggle} />
            ))}
          </div>
        </Card>

        {/* Gastos por categoria */}
        <Card className="lg:col-span-2">
          <CardHeader title="Gastos por categoria" />
          {byCategory.length === 0 ? (
            <EmptyState icon={<Wallet className="size-6" />} title="Sem despesas ainda" />
          ) : (
            <div className="p-4 md:p-5">
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={56} outerRadius={80} paddingAngle={2} stroke="none">
                      {byCategory.map((c) => <Cell key={c.id} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div><p className="text-[11px] text-muted">Total</p><p className="tnum text-sm font-bold">{money(s.expense)}</p></div>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {byCategory.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="tnum text-muted">{pct(percentOf(c.value, s.expense))}</span>
                    <span className="tnum w-24 text-right font-medium">{money(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
        {/* Evolução */}
        <Card className="lg:col-span-3">
          <CardHeader title="Últimos 6 meses" />
          <div className="h-56 px-2 pb-3 pt-2 md:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={4}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "var(--surface-2)" }} formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} />
                <Bar dataKey="Receitas" fill="var(--income)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Despesas" fill="var(--expense)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 pb-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-income" /> Receitas</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-expense" /> Despesas</span>
          </div>
        </Card>

        <div className="space-y-4 md:space-y-6 lg:col-span-2">
          {/* Por pessoa */}
          <Card>
            <CardHeader title="Despesas por pessoa" />
            <div className="space-y-3 p-4 md:p-5">
              {byPerson.length === 0 && <p className="text-sm text-muted">Sem despesas neste mês.</p>}
              {byPerson.map((p) => (
                <div key={p.id}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{p.name}</span><span className="tnum">{money(p.value)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${percentOf(p.value, byPerson[0].value)}%`, background: p.color }} /></div>
                </div>
              ))}
            </div>
          </Card>

          {/* Parcelas */}
          <Card>
            <CardHeader title="Parcelas em aberto" action={<Link href="/planejamento" className="text-sm font-medium text-brand hover:underline">Detalhes</Link>} />
            <div className="p-4 md:p-5">
              <p className="tnum text-2xl font-bold">{money(installmentsTotal)}</p>
              <p className="text-sm text-muted">em {openGroups.length} {openGroups.length === 1 ? "compra parcelada" : "compras parceladas"}</p>
              <ul className="mt-3 space-y-1.5">
                {openGroups.slice(0, 3).map((g) => (
                  <li key={g.group_id} className="flex justify-between text-sm"><span className="truncate pr-2">{g.description} <span className="text-muted">({g.pending_count}x)</span></span><span className="tnum text-muted">{moneyCompact(g.remaining_cents)}</span></li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--fg)" } as const;

function StatCard({ icon, tone, label, total, done, doneLabel, loading }: {
  icon: React.ReactNode; tone: "income" | "expense" | "brand"; label: string; total: number; done: number; doneLabel: string; loading: boolean;
}) {
  const color = { income: "text-income bg-income-soft", expense: "text-expense bg-expense-soft", brand: "text-brand bg-brand-soft" }[tone];
  const progress = percentOf(done, total);
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted">
        <span className={cn("grid size-8 place-items-center rounded-full", color)}>{icon}</span>{label}
      </div>
      {loading ? <Skeleton className="mt-3 h-7 w-28" /> : <p className="tnum mt-3 text-2xl font-bold">{money(total)}</p>}
      <Progress className="mt-3" value={progress} tone={tone} />
      <p className="tnum mt-2 text-xs text-muted">{money(done)} {doneLabel} · {pct(progress)}</p>
    </Card>
  );
}
