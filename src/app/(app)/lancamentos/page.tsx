"use client";

import { useMemo, useState } from "react";
import { Plus, Search, SearchX } from "lucide-react";
import { useMonth } from "@/hooks/use-month";
import { useMaterializeRecurring, useMonthTransactions, useRefs } from "@/hooks/queries";
import { useToggleStatus } from "@/hooks/mutations";
import { useTxSheet } from "@/components/finance/tx-sheet";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { TxRow } from "@/components/finance/tx-row";
import { Card, EmptyState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, Segmented, inputCls } from "@/components/ui/fields";
import { dayLabel } from "@/lib/dates";
import { money } from "@/lib/format";
import { sumCents } from "@/domain/money";
import { savingsSet, summarize } from "@/domain/summary";
import { cn } from "@/lib/cn";
import type { Transaction } from "@/types/db";

type KindFilter = "all" | "expense" | "income";
type StatusFilter = "all" | "pending" | "done";

export default function LancamentosPage() {
  const { month, setMonth } = useMonth();
  const refs = useRefs();
  const { open } = useTxSheet();
  const toggle = useToggleStatus();
  useMaterializeRecurring(month);
  const { data, isLoading } = useMonthTransactions(month);

  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [person, setPerson] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((t) =>
      (kind === "all" || t.kind === kind) &&
      (status === "all" || t.status === status) &&
      (!person || t.person_id === person) &&
      (!category || t.category_id === category) &&
      (!needle || t.description.toLowerCase().includes(needle)),
    );
  }, [data, kind, status, person, category, q]);

  const savings = useMemo(() => savingsSet(refs.categories), [refs.categories]);
  const totals = useMemo(() => summarize(filtered, savings), [filtered, savings]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    filtered.forEach((t) => m.set(t.due_date, [...(m.get(t.due_date) ?? []), t]));
    return [...m.entries()];
  }, [filtered]);

  const hasFilter = kind !== "all" || status !== "all" || !!person || !!category || !!q;
  const clear = () => { setKind("all"); setStatus("all"); setPerson(null); setCategory(""); setQ(""); };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold md:text-2xl">Lançamentos</h1>
        <div className="flex items-center gap-2">
          <MonthSwitcher month={month} onChange={setMonth} />
          <Button className="hidden md:inline-flex" onClick={() => open()}><Plus className="size-5" /> Novo</Button>
        </div>
      </header>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lançamento..." aria-label="Buscar" className={cn(inputCls, "pl-9")} />
          </div>
          <Segmented<KindFilter> className="md:w-72" value={kind} onChange={setKind} options={[{ value: "all", label: "Todos" }, { value: "expense", label: "Despesas" }, { value: "income", label: "Receitas" }]} />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none]">
          <Chip active={status === "all"} onClick={() => setStatus("all")}>Todos status</Chip>
          <Chip active={status === "pending"} onClick={() => setStatus("pending")}>Pendentes</Chip>
          <Chip active={status === "done"} onClick={() => setStatus("done")}>Pagos / recebidos</Chip>
          <span className="mx-1 w-px shrink-0 bg-border" />
          {refs.people.filter((p) => !p.archived).map((p) => (
            <Chip key={p.id} color={p.color} active={person === p.id} onClick={() => setPerson(person === p.id ? null : p.id)}>{p.name}</Chip>
          ))}
          <select
            value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar por categoria"
            className="h-9 shrink-0 rounded-full border border-border bg-surface px-3 text-sm font-medium text-muted"
          >
            <option value="">Todas categorias</option>
            {refs.categories.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Totais do filtro */}
      <div className="grid grid-cols-3 gap-2 text-center md:gap-3">
        <MiniTotal label="Receitas" value={totals.income} tone="income" />
        <MiniTotal label="Despesas" value={totals.expense + totals.saved} tone="expense" />
        <MiniTotal label="Saldo" value={totals.balance} tone={totals.balance < 0 ? "expense" : "brand"} />
      </div>

      <Card className="overflow-hidden">
        {isLoading && <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {!isLoading && groups.length === 0 && (
          hasFilter ? (
            <EmptyState icon={<SearchX className="size-6" />} title="Nada encontrado" hint="Nenhum lançamento corresponde aos filtros." action={<Button variant="soft" onClick={clear}>Limpar filtros</Button>} />
          ) : (
            <EmptyState icon={<Plus className="size-6" />} title="Nenhum lançamento neste mês" hint="Toque em + para adicionar sua primeira receita ou despesa." action={<Button onClick={() => open()}><Plus className="size-5" /> Adicionar</Button>} />
          )
        )}
        {groups.map(([date, items]) => (
          <section key={date}>
            <h3 className="sticky top-0 z-10 flex items-center justify-between bg-surface-2/90 px-4 py-1.5 text-xs font-semibold capitalize text-muted backdrop-blur">
              <span>{dayLabel(date)}</span>
              <span className="tnum font-medium normal-case">
                {money(sumCents(items.map((t) => (t.kind === "income" ? t.amount_cents : -t.amount_cents))))}
              </span>
            </h3>
            <div className="divide-y divide-border">
              {items.map((t) => (
                <TxRow key={t.id} tx={t} category={t.category_id ? refs.categoryById.get(t.category_id) : undefined} person={t.person_id ? refs.personById.get(t.person_id) : undefined} onOpen={(x) => open({ tx: x })} onToggle={toggle} />
              ))}
            </div>
          </section>
        ))}
      </Card>
    </div>
  );
}

function MiniTotal({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" | "brand" }) {
  const c = { income: "text-income", expense: "text-expense", brand: "text-brand" }[tone];
  return (
    <div className="rounded-2xl border border-border bg-surface px-2 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("tnum text-sm font-bold md:text-lg", c)}>{money(value)}</p>
    </div>
  );
}
