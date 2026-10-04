"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, CalendarClock, PiggyBank, Sparkles, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useMonth } from "@/hooks/use-month";
import {
  useBudgets, useCategoryTotals, useInstallmentGroups, useMaterializeRecurring, useMonthTransactions,
  usePeriodSummary, usePersonTotals, useRefs,
} from "@/hooks/queries";
import { useToggleStatus } from "@/hooks/mutations";
import { useTxSheet } from "@/components/finance/tx-sheet";
import { TxRow } from "@/components/finance/tx-row";
import { CategoryBadge } from "@/components/finance/category-badge";
import { PageHeader } from "@/components/layout/page-header";
import { usePrivacy } from "@/components/privacy";
import { Money } from "@/components/ui/money";
import { Card, CardHeader, EmptyState, Progress, Skeleton } from "@/components/ui/card";
import { monthFirstDay, monthLabel, monthRange, monthShort, shiftMonth, today } from "@/lib/dates";
import { money, moneyCompact, pct } from "@/lib/format";
import { percentOf, sumCents } from "@/domain/money";
import { summaryFromRow, type Summary } from "@/domain/summary";
import { cn } from "@/lib/cn";

const EMPTY: Summary = {
  income: 0, incomeDone: 0, incomePending: 0, expense: 0, expenseDone: 0, expensePending: 0,
  saved: 0, savedDone: 0, balance: 0, cash: 0,
};

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };

export default function DashboardPage() {
  const { month, setMonth } = useMonth();
  const refs = useRefs();
  const { open } = useTxSheet();
  const toggle = useToggleStatus();
  const { hidden } = usePrivacy();
  useMaterializeRecurring(month);

  const { from, to } = monthRange(month);
  const summaryQ = usePeriodSummary(monthFirstDay(shiftMonth(month, -5)), to); // 6 meses, agregado no banco
  const categoriesQ = useCategoryTotals(from, to);
  const peopleQ = usePersonTotals(from, to);
  const txQ = useMonthTransactions(month);
  const installmentsQ = useInstallmentGroups();
  const budgetsQ = useBudgets(month);
  const isLoading = summaryQ.isLoading;

  const trend = useMemo(
    () => (summaryQ.data ?? []).map((r) => ({ key: r.month.slice(0, 7), label: monthShort(r.month.slice(0, 7)), ...summaryFromRow(r) })),
    [summaryQ.data],
  );
  const s = trend.find((t) => t.key === month) ?? EMPTY;
  const prev = trend.find((t) => t.key === shiftMonth(month, -1));
  const chart = trend.map((t) => ({ key: t.key, label: t.label, Receitas: t.income, Despesas: t.expense + t.saved }));

  const byCategory = useMemo(
    () => (categoriesQ.data ?? []).map((r) => {
      const c = r.category_id ? refs.categoryById.get(r.category_id) : undefined;
      return { id: r.category_id ?? "none", name: c?.name ?? "Sem categoria", color: c?.color ?? "#94a3b8", icon: c?.icon, value: r.total_cents };
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
  const overdue = monthTx.filter((t) => t.status === "pending" && t.due_date < today());
  const openGroups = (installmentsQ.data ?? []).filter((g) => g.pending_count > 0);
  const installmentsTotal = sumCents(openGroups.map((g) => g.remaining_cents));

  // orçamento: categorias com limite, da mais "cheia" para a mais folgada
  const budgetRows = useMemo(() => {
    const spent = new Map((categoriesQ.data ?? []).map((r) => [r.category_id, r.total_cents]));
    return (budgetsQ.data ?? [])
      .map((b) => ({ b, c: refs.categoryById.get(b.category_id), spent: spent.get(b.category_id) ?? 0 }))
      .map((r) => ({ ...r, ratio: percentOf(r.spent, r.b.amount_cents) }))
      .sort((a, b) => b.ratio - a.ratio);
  }, [budgetsQ.data, categoriesQ.data, refs.categoryById]);

  // frases curtas que resumem o que importa
  const insights = useMemo(() => {
    const list: { tone: "bad" | "warn" | "good"; icon: React.ReactNode; text: string; href?: string }[] = [];
    if (overdue.length) list.push({ tone: "bad", icon: <AlertTriangle className="size-4" />, text: `${overdue.length} ${overdue.length === 1 ? "conta atrasada" : "contas atrasadas"}`, href: `/lancamentos?m=${month}&status=pending` });
    const over = budgetRows.find((r) => r.ratio > 100);
    if (over) list.push({ tone: "bad", icon: <Target className="size-4" />, text: `${over.c?.name ?? "Categoria"} passou do orçamento`, href: "/orcamento" });
    else { const near = budgetRows.find((r) => r.ratio > 85); if (near) list.push({ tone: "warn", icon: <Target className="size-4" />, text: `${near.c?.name ?? "Categoria"} usou ${pct(near.ratio)} do limite`, href: "/orcamento" }); }
    if (prev && prev.expense > 0 && s.expense > 0) {
      const d = ((s.expense - prev.expense) / prev.expense) * 100;
      if (Math.abs(d) >= 3) list.push(d < 0
        ? { tone: "good", icon: <TrendingDown className="size-4" />, text: `Gastos previstos ${pct(-d)} menores que em ${monthLabel(shiftMonth(month, -1)).split(" ")[0].toLowerCase()}` }
        : { tone: "warn", icon: <TrendingUp className="size-4" />, text: `Gastos previstos ${pct(d)} maiores que em ${monthLabel(shiftMonth(month, -1)).split(" ")[0].toLowerCase()}` });
    }
    return list.slice(0, 3);
  }, [overdue.length, budgetRows, prev, s.expense, month]);

  const total = Math.max(s.income, s.expense + s.saved, 1);
  const paidAmt = s.expenseDone + s.savedDone;
  const pendingAmt = s.expense + s.saved - paidAmt;
  const leftover = Math.max(s.income - s.expense - s.saved, 0);
  const negative = s.balance < 0;
  const name = refs.people[0]?.name ?? "";
  const fmt = (v: unknown) => (hidden ? "••••" : money(Number(v)));

  return (
    <div className="space-y-5 pt-4 md:space-y-6 md:pt-0">
      <PageHeader title={name ? `${greeting()}, ${name}` : "Visão geral"} subtitle="Como está o seu mês" month={{ value: month, onChange: setMonth }} />

      <div className="grid gap-5 md:gap-6 lg:grid-cols-12">
        {/* ── Hero ── */}
        <section className={cn("relative overflow-hidden rounded-[28px] p-5 text-white shadow-[var(--shadow-float)] md:p-7 lg:col-span-8 lg:col-start-1", negative ? "danger-gradient" : "brand-gradient")}>
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white/80">Sobra prevista de {monthLabel(month).split(" ")[0].toLowerCase()}</p>
              {prev && <DeltaPill now={s.balance} before={prev.balance} label={monthShort(shiftMonth(month, -1))} />}
            </div>
            {isLoading ? <Skeleton className="mt-3 h-12 w-56 bg-white/20" /> : <Money cents={s.balance} className="mt-1 block text-[44px] font-bold leading-tight tracking-tight md:text-6xl" />}
            <p className="mt-1 text-sm text-white/75">Em caixa agora <Money cents={s.cash} className="font-semibold text-white" /></p>

            {/* composição do mês: de onde vem e para onde vai o dinheiro */}
            <div className="mt-6" role="img" aria-label="Composição das receitas do mês">
              <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
                {[{ v: paidAmt, c: "bg-white" }, { v: pendingAmt, c: "bg-white/55" }, { v: leftover, c: "bg-white/20" }].map((seg, i) => (
                  <div key={i} className={cn("grow-x h-full rounded-full", seg.c)} style={{ width: `${(seg.v / total) * 100}%`, minWidth: seg.v > 0 ? 6 : 0 }} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Legend dot="bg-white" label="Já saiu" cents={paidAmt} />
                <Legend dot="bg-white/55" label="A pagar" cents={pendingAmt} />
                <Legend dot="bg-white/25" label="Sobra" cents={leftover} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Resumo rápido (carrossel no celular) ── */}
        <section aria-label="Resumo" className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 lg:col-span-8 lg:col-start-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0">
          <QuickStat icon={<ArrowUpCircle />} tone="income" label="Receitas" total={s.income} done={s.incomeDone} doneLabel="recebido" loading={isLoading} />
          <QuickStat icon={<ArrowDownCircle />} tone="expense" label="Despesas" total={s.expense} done={s.expenseDone} doneLabel="pago" loading={isLoading} />
          <QuickStat icon={<PiggyBank />} tone="brand" label="Guardado" total={s.saved} done={s.savedDone} doneLabel="guardado" loading={isLoading} />
          <QuickStat icon={<Wallet />} tone={s.cash < 0 ? "expense" : "brand"} label="Em caixa" total={s.cash} loading={isLoading} hint="recebido − pago" />
        </section>

        {/* ── Alertas / insights ── */}
        {insights.length > 0 && (
          <section aria-label="Avisos" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:col-span-8 lg:col-start-1 lg:mx-0 lg:flex-wrap lg:px-0">
            {insights.map((i, k) => {
              const cls = { bad: "bg-expense-soft text-expense", warn: "bg-warn-soft text-warn", good: "bg-income-soft text-income" }[i.tone];
              const inner = <><span className="shrink-0">{i.icon}</span><span>{i.text}</span></>;
              const base = cn("flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold", cls);
              return i.href ? <Link key={k} href={i.href} className={cn(base, "transition active:scale-95")}>{inner}</Link> : <span key={k} className={base}>{inner}</span>;
            })}
          </section>
        )}

        {/* ── Próximos vencimentos ── */}
        <Card className="overflow-hidden lg:col-span-4 lg:col-start-9 lg:row-span-3 lg:row-start-1">
          <CardHeader
            title={<span className="flex items-center gap-2"><CalendarClock className="size-4" /> A pagar e receber</span>}
            action={<Link href={`/lancamentos?m=${month}&status=pending`} className="text-sm font-semibold text-brand hover:underline">Ver todos</Link>}
          />
          <div className="mt-2 divide-y divide-border/70 pb-1">
            {txQ.isLoading && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
            {!txQ.isLoading && upcoming.length === 0 && (
              <EmptyState icon={<Sparkles className="size-6" />} title="Tudo em dia 🎉" hint="Nada pendente neste mês." />
            )}
            {upcoming.map((t) => (
              <TxRow key={t.id} tx={t} showDate category={t.category_id ? refs.categoryById.get(t.category_id) : undefined} person={t.person_id ? refs.personById.get(t.person_id) : undefined} onOpen={(x) => open({ tx: x })} onToggle={toggle} />
            ))}
          </div>
        </Card>

        {/* ── Gastos por categoria ── */}
        <Card className="lg:col-span-5 lg:col-start-1">
          <CardHeader title="Para onde foi o dinheiro" />
          {categoriesQ.isLoading ? <div className="p-5"><Skeleton className="h-48" /></div> : byCategory.length === 0 ? (
            <EmptyState icon={<Wallet className="size-6" />} title="Sem despesas neste mês" />
          ) : (
            <div className="p-4 md:p-5">
              <div className="relative mx-auto h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={62} outerRadius={90} paddingAngle={3} cornerRadius={6} stroke="none">
                      {byCategory.map((c) => <Cell key={c.id} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={fmt} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div><p className="text-[11px] font-medium text-muted">Despesas</p><Money cents={s.expense} className="text-lg font-bold" /></div>
                </div>
              </div>
              <ul className="mt-4 space-y-0.5">
                {byCategory.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link href={c.id === "none" ? `/lancamentos?m=${month}` : `/lancamentos?m=${month}&cat=${c.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
                      <CategoryBadge icon={c.icon} color={c.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                      <span className="tnum text-xs text-muted">{pct(percentOf(c.value, s.expense))}</span>
                      <Money cents={c.value} className="w-28 text-right text-sm font-semibold" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* ── Evolução ── */}
        <Card className="flex flex-col lg:col-span-7">
          <CardHeader title="Últimos 6 meses" />
          <div className="min-h-56 flex-1 px-2 pb-1 pt-4 md:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={3} barCategoryGap="22%">
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "var(--surface-2)", radius: 8 }} formatter={fmt} contentStyle={tooltipStyle} />
                <Bar dataKey="Receitas" radius={[7, 7, 3, 3]}>{chart.map((c) => <Cell key={c.key} fill="var(--income)" fillOpacity={c.key === month ? 1 : 0.35} />)}</Bar>
                <Bar dataKey="Despesas" radius={[7, 7, 3, 3]}>{chart.map((c) => <Cell key={c.key} fill="var(--expense)" fillOpacity={c.key === month ? 1 : 0.35} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-5 pb-4 text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-income" /> Receitas</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-expense" /> Despesas</span>
          </div>
        </Card>

        {/* ── Orçamento / pessoas / parcelas ── */}
        <div className="grid gap-5 md:grid-cols-3 md:gap-6 lg:col-span-12">
          <Card>
            <CardHeader title="Orçamento" action={<Link href="/orcamento" className="text-sm font-semibold text-brand hover:underline">Ver</Link>} />
            <div className="space-y-4 p-4 md:p-5">
              {budgetRows.length === 0 && <p className="text-sm text-muted">Defina limites por categoria para acompanhar aqui.</p>}
              {budgetRows.slice(0, 4).map(({ b, c, spent, ratio }) => (
                <div key={b.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{c?.name}</span>
                    <span className={cn("tnum text-xs font-semibold", ratio > 100 ? "text-expense" : "text-muted")}>{pct(ratio)}</span>
                  </div>
                  <Progress value={ratio} tone={ratio > 100 ? "expense" : ratio > 85 ? "warn" : "brand"} />
                  <p className="tnum mt-1 text-[11px] text-muted"><Money cents={spent} /> de <Money cents={b.amount_cents} /></p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Por pessoa" />
            <div className="space-y-4 p-4 md:p-5">
              {byPerson.length === 0 && <p className="text-sm text-muted">Sem despesas neste mês.</p>}
              {byPerson.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: p.color }}>{p.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{p.name}</span><Money cents={p.value} className="font-semibold" /></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="grow-x h-full rounded-full" style={{ width: `${percentOf(p.value, byPerson[0].value)}%`, background: p.color }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Parcelas em aberto" action={<Link href="/planejamento" className="text-sm font-semibold text-brand hover:underline">Ver</Link>} />
            <div className="p-4 md:p-5">
              <Money cents={installmentsTotal} className="block text-3xl font-bold tracking-tight" />
              <p className="text-sm text-muted">em {openGroups.length} {openGroups.length === 1 ? "compra parcelada" : "compras parceladas"}</p>
              <ul className="mt-4 space-y-2.5">
                {openGroups.slice(0, 3).map((g) => (
                  <li key={g.group_id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{g.description} <span className="font-normal text-muted">· faltam {g.pending_count}</span></span>
                    <Money cents={g.remaining_cents} className="font-semibold text-muted" />
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12, color: "var(--fg)", boxShadow: "0 10px 30px -10px rgb(0 0 0 / .3)" } as const;

function Legend({ dot, label, cents }: { dot: string; label: string; cents: number }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-white/75"><i className={cn("size-2 shrink-0 rounded-full", dot)} />{label}</p>
      <Money cents={cents} className="text-[13px] font-semibold md:text-sm" />
    </div>
  );
}

/** Variação em relação ao mês anterior. */
function DeltaPill({ now, before, label }: { now: number; before: number; label: string }) {
  const diff = now - before;
  if (Math.abs(diff) < 100) return null; // menos de R$ 1: não vale mostrar
  const up = diff > 0;
  return (
    <span className="amt inline-flex shrink-0 items-center gap-1 rounded-full bg-white/18 px-2.5 py-1 text-xs font-semibold backdrop-blur" title={`Comparado a ${label}`}>
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {up ? "+" : "−"}{moneyCompact(Math.abs(diff))} <span className="font-medium text-white/70">vs. {label}</span>
    </span>
  );
}

function QuickStat({ icon, tone, label, total, done, doneLabel, hint, loading }: {
  icon: React.ReactNode; tone: "income" | "expense" | "brand"; label: string; total: number; done?: number; doneLabel?: string; hint?: string; loading: boolean;
}) {
  const color = { income: "text-income bg-income-soft", expense: "text-expense bg-expense-soft", brand: "text-brand bg-brand-soft" }[tone];
  const progress = done === undefined ? null : percentOf(done, total);
  return (
    <Card className="w-[11.5rem] shrink-0 snap-start p-4 lg:w-auto">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <span className={cn("grid size-8 place-items-center rounded-full [&_svg]:size-[18px]", color)}>{icon}</span>{label}
      </div>
      {loading ? <Skeleton className="mt-3 h-7 w-24" /> : <Money cents={total} className="mt-3 block text-[22px] font-bold tracking-tight" />}
      {progress !== null ? (
        <>
          <Progress className="mt-3 h-1.5" value={progress} tone={tone} />
          <p className="mt-1.5 text-[11px] text-muted"><Money cents={done ?? 0} /> {doneLabel} · {pct(progress)}</p>
        </>
      ) : (
        <p className="mt-3 text-[11px] text-muted">{hint}</p>
      )}
    </Card>
  );
}
