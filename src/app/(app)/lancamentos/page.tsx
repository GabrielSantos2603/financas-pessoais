"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, SearchX, X } from "lucide-react";
import { useMonth } from "@/hooks/use-month";
import { useMaterializeRecurring, useMonthTransactions, useRefs } from "@/hooks/queries";
import { useToggleStatus } from "@/hooks/mutations";
import { useTxSheet } from "@/components/finance/tx-sheet";
import { TxRow } from "@/components/finance/tx-row";
import { PageHeader } from "@/components/layout/page-header";
import { Money } from "@/components/ui/money";
import { Card, EmptyState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, Segmented, inputCls } from "@/components/ui/fields";
import { dayLabel, dayParts } from "@/lib/dates";
import { sumCents } from "@/domain/money";
import { savingsSet, summarize } from "@/domain/summary";
import { cn } from "@/lib/cn";
import type { Transaction } from "@/types/db";

type KindFilter = "all" | "expense" | "income";
type StatusFilter = "all" | "pending" | "done";

export default function LancamentosPage() {
  const { month, setMonth } = useMonth();
  const params = useSearchParams();
  const refs = useRefs();
  const { open } = useTxSheet();
  const toggle = useToggleStatus();
  useMaterializeRecurring(month);
  const { data, isLoading } = useMonthTransactions(month);

  // filtros iniciais podem vir da URL (ex.: tocar numa categoria ou em "contas atrasadas" no Início)
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>(() => (["pending", "done"].includes(params.get("status") ?? "") ? (params.get("status") as StatusFilter) : "all"));
  const [person, setPerson] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(() => params.get("cat") ?? "");
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
  const activeCategory = category ? refs.categoryById.get(category) : undefined;

  return (
    <div className="pb-4">
      <PageHeader
        title="Lançamentos" subtitle="Tudo que entrou e saiu" month={{ value: month, onChange: setMonth }}
        actions={<Button className="ml-1 hidden md:inline-flex" onClick={() => open()}><Plus className="size-5" /> Novo</Button>}
      />

      <div className="mt-4 space-y-3 md:mt-0">
        {/* busca + tipo */}
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lançamento..." aria-label="Buscar" className={cn(inputCls, "h-12 rounded-2xl pl-10 pr-10")} />
            {q && <button aria-label="Limpar busca" onClick={() => setQ("")} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2"><X className="size-4" /></button>}
          </div>
          <Segmented<KindFilter> className="md:w-80" value={kind} onChange={setKind} options={[{ value: "all", label: "Todos" }, { value: "expense", label: "Despesas", tone: "expense" }, { value: "income", label: "Receitas", tone: "income" }]} />
        </div>

        {/* chips */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0">
          <Chip active={status === "pending"} onClick={() => setStatus(status === "pending" ? "all" : "pending")}>Pendentes</Chip>
          <Chip active={status === "done"} onClick={() => setStatus(status === "done" ? "all" : "done")}>Pagos / recebidos</Chip>
          <span className="mx-0.5 w-px shrink-0 self-stretch bg-border" />
          {refs.people.filter((p) => !p.archived).map((p) => (
            <Chip key={p.id} color={p.color} active={person === p.id} onClick={() => setPerson(person === p.id ? null : p.id)}>{p.name}</Chip>
          ))}
          <select
            value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar por categoria"
            className={cn("h-9 shrink-0 rounded-full border px-3 text-sm font-medium", category ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-muted")}
          >
            <option value="">Todas as categorias</option>
            {refs.categories.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {hasFilter && <button onClick={clear} className="h-9 shrink-0 rounded-full px-3 text-sm font-semibold text-brand hover:bg-brand-soft">Limpar</button>}
        </div>

        {/* totais do filtro */}
        <Card className="grid grid-cols-3 divide-x divide-border py-3.5 text-center">
          <Total label="Receitas" cents={totals.income} tone="income" />
          <Total label="Despesas" cents={totals.expense + totals.saved} tone="expense" />
          <Total label={activeCategory ? activeCategory.name : "Saldo"} cents={totals.balance} tone={totals.balance < 0 ? "expense" : "brand"} />
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        {isLoading && <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>}
        {!isLoading && groups.length === 0 && (
          hasFilter ? (
            <EmptyState icon={<SearchX className="size-6" />} title="Nada encontrado" hint="Nenhum lançamento corresponde aos filtros." action={<Button variant="soft" onClick={clear}>Limpar filtros</Button>} />
          ) : (
            <EmptyState icon={<Plus className="size-6" />} title="Nenhum lançamento neste mês" hint="Toque em + para adicionar sua primeira receita ou despesa." action={<Button onClick={() => open()}><Plus className="size-5" /> Adicionar</Button>} />
          )
        )}
        {groups.map(([date, items]) => {
          const { day, month: mon } = dayParts(date);
          const net = sumCents(items.map((t) => (t.kind === "income" ? t.amount_cents : -t.amount_cents)));
          return (
            <section key={date}>
              <h3 className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 flex items-center justify-between border-y border-border/60 bg-surface-2/90 px-4 py-2 text-xs font-semibold backdrop-blur first:border-t-0 md:top-0 md:px-5">
                <span>{dayLabel(date)}{/^\D+$/.test(dayLabel(date)) && <span className="font-medium text-muted"> · {day} {mon}</span>}</span>
                <Money cents={net} sign className={cn("font-semibold", net < 0 ? "text-muted" : "text-income")} />
              </h3>
              <div className="divide-y divide-border/60">
                {items.map((t) => (
                  <TxRow key={t.id} tx={t} category={t.category_id ? refs.categoryById.get(t.category_id) : undefined} person={t.person_id ? refs.personById.get(t.person_id) : undefined} onOpen={(x) => open({ tx: x })} onToggle={toggle} />
                ))}
              </div>
            </section>
          );
        })}
      </Card>
      {groups.length > 0 && <p className="mt-3 text-center text-xs text-muted md:hidden">Dica: deslize um lançamento para a direita para marcar como pago.</p>}
    </div>
  );
}

function Total({ label, cents, tone }: { label: string; cents: number; tone: "income" | "expense" | "brand" }) {
  const c = { income: "text-income", expense: "text-expense", brand: "text-brand" }[tone];
  return (
    <div className="min-w-0 px-2">
      <p className="truncate text-xs font-medium text-muted">{label}</p>
      <Money cents={cents} className={cn("text-[15px] font-bold md:text-lg", c)} />
    </div>
  );
}
