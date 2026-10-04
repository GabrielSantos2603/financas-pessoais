"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Copy, Target } from "lucide-react";
import { useBudgets, useCategoryTotals, useMaterializeRecurring, useRefs } from "@/hooks/queries";
import { useBudgetMutations } from "@/hooks/mutations";
import { useMonth } from "@/hooks/use-month";
import { CategoryBadge } from "@/components/finance/category-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Money } from "@/components/ui/money";
import { Card, EmptyState, Progress, Ring, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { monthFirstDay, monthRange, shiftMonth } from "@/lib/dates";
import { money, pct } from "@/lib/format";
import { percentOf, sumCents } from "@/domain/money";
import { cn } from "@/lib/cn";
import type { Category } from "@/types/db";

export default function OrcamentoPage() {
  const { month, setMonth } = useMonth();
  const toast = useToast();
  const refs = useRefs();
  const mutations = useBudgetMutations();
  useMaterializeRecurring(month);
  const { from, to } = monthRange(month);
  const { data: budgets, isLoading } = useBudgets(month);
  const { data: totals } = useCategoryTotals(from, to);
  const [editing, setEditing] = useState<Category | null>(null);

  const budgetBy = useMemo(() => new Map((budgets ?? []).map((b) => [b.category_id, b.amount_cents])), [budgets]);
  const spentBy = useMemo(() => new Map((totals ?? []).map((t) => [t.category_id, t.total_cents])), [totals]);
  const cats = refs.categories.filter((c) => c.kind === "expense" && !c.archived && !c.is_savings);

  const rows = cats.map((c) => ({ c, budget: budgetBy.get(c.id) ?? 0, spent: spentBy.get(c.id) ?? 0 }))
    .sort((a, b) => (b.budget ? percentOf(b.spent, b.budget) : -1) - (a.budget ? percentOf(a.spent, a.budget) : -1) || b.spent - a.spent);
  const withBudget = rows.filter((r) => r.budget > 0);
  const without = rows.filter((r) => r.budget === 0);
  const totalBudget = sumCents(withBudget.map((r) => r.budget));
  const totalSpent = sumCents(withBudget.map((r) => r.spent));
  const used = percentOf(totalSpent, totalBudget);
  const left = totalBudget - totalSpent;

  function copyPrevious() {
    mutations.copy.mutate(
      { from: monthFirstDay(shiftMonth(month, -1)), to: monthFirstDay(month) },
      {
        onSuccess: (n) => toast(n ? "Orçamento copiado do mês anterior" : "O mês anterior não tem orçamento.", { tone: n ? "ok" : "error" }),
        onError: (e) => toast(e.message, { tone: "error" }),
      },
    );
  }

  return (
    <div className="pb-4">
      <PageHeader title="Orçamento" subtitle="Defina um limite por categoria e acompanhe" month={{ value: month, onChange: setMonth }} />

      <div className="mt-4 space-y-5 md:mt-0 md:space-y-6">
        <Card className="p-5 md:p-6">
          <div className="flex items-center gap-5">
            <Ring value={used} size={118} stroke={13}>
              <div>
                <p className="tnum text-[26px] font-bold leading-none">{pct(used)}</p>
                <p className="mt-1 text-[11px] font-medium text-muted">usado</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">Gasto nas categorias com limite</p>
              <Money cents={totalSpent} className="block text-[28px] font-bold leading-tight tracking-tight" />
              <p className="text-sm text-muted">de <Money cents={totalBudget} className="font-semibold text-fg" /></p>
              {totalBudget > 0 && (
                <p className={cn("mt-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-semibold", left >= 0 ? "bg-income-soft text-income" : "bg-expense-soft text-expense")}>
                  {left >= 0 ? <>Restam <Money cents={left} /></> : <>Estourou <Money cents={-left} /></>}
                </p>
              )}
            </div>
          </div>
          <Button variant="soft" className="mt-5 w-full" loading={mutations.copy.isPending} onClick={copyPrevious}><Copy className="size-4" /> Copiar limites do mês anterior</Button>
        </Card>

        {isLoading && <Skeleton className="h-64 rounded-[22px]" />}

        {!isLoading && rows.length === 0 && <Card><EmptyState icon={<Target className="size-6" />} title="Sem categorias de despesa" /></Card>}

        {withBudget.length > 0 && (
          <Card className="divide-y divide-border/70 overflow-hidden">
            {withBudget.map((r) => <BudgetRow key={r.c.id} {...r} onClick={() => setEditing(r.c)} />)}
          </Card>
        )}

        {without.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-muted">Sem limite definido</h2>
            <Card className="divide-y divide-border/70 overflow-hidden">
              {without.map((r) => <BudgetRow key={r.c.id} {...r} onClick={() => setEditing(r.c)} />)}
            </Card>
          </section>
        )}
      </div>

      {editing && (
        <BudgetSheet
          category={editing} initial={budgetBy.get(editing.id) ?? 0} spent={spentBy.get(editing.id) ?? 0}
          saving={mutations.set.isPending} error={mutations.set.error?.message}
          onClose={() => { mutations.set.reset(); setEditing(null); }}
          onSave={(amountCents) =>
            mutations.set.mutate({ categoryId: editing.id, monthFirstDay: monthFirstDay(month), amountCents }, { onSuccess: () => setEditing(null) })
          }
        />
      )}
    </div>
  );
}

function BudgetRow({ c, budget, spent, onClick }: { c: Category; budget: number; spent: number; onClick: () => void }) {
  const ratio = percentOf(spent, budget);
  const over = budget > 0 && spent > budget;
  return (
    <button onClick={onClick} className="block w-full px-4 py-3.5 text-left transition hover:bg-surface-2/50 md:px-5">
      <div className="flex items-center gap-3">
        <CategoryBadge icon={c.icon} color={c.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{c.name}</span>
          <span className="block text-xs text-muted">
            <Money cents={spent} className={cn("font-semibold", over ? "text-expense" : "text-fg")} />
            {budget > 0 ? <> de <Money cents={budget} /></> : " gastos · toque para definir um limite"}
          </span>
        </span>
        {budget > 0 && <span className={cn("tnum rounded-full px-2 py-0.5 text-xs font-bold", over ? "bg-expense-soft text-expense" : ratio > 85 ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>{pct(ratio)}</span>}
        <ChevronRight className="size-4 shrink-0 text-muted" />
      </div>
      {budget > 0 && <Progress className="mt-3" value={ratio} tone={over ? "expense" : ratio > 85 ? "warn" : "brand"} />}
    </button>
  );
}

function BudgetSheet({ category, initial, spent, saving, error, onClose, onSave }: {
  category: Category; initial: number; spent: number; saving: boolean; error?: string;
  onClose: () => void; onSave: (cents: number) => void;
}) {
  // sugere o gasto atual arredondado para cima em múltiplos de R$ 50
  const [cents, setCents] = useState(initial || Math.ceil(spent / 5000) * 5000);
  return (
    <Sheet open onClose={onClose} title={`Limite · ${category.name}`}
      footer={
        <div className="space-y-2">
          {error && <p role="alert" className="rounded-xl bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          <Button className="w-full rounded-2xl" size="lg" loading={saving} onClick={() => onSave(cents)}>Salvar limite</Button>
        </div>
      }>
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3"><CategoryBadge icon={category.icon} color={category.color} /><p className="font-semibold">{category.name}</p></div>
        <MoneyInput large value={cents} onChange={setCents} autoFocus />
        <p className="text-sm text-muted">Gasto neste mês: <b className="tnum text-fg">{money(spent)}</b>. Deixe em R$ 0,00 para remover o limite.</p>
      </div>
    </Sheet>
  );
}
