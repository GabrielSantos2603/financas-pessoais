"use client";

import { useMemo, useState } from "react";
import { Copy, Target } from "lucide-react";
import { useBudgets, useCategoryTotals, useMaterializeRecurring, useRefs } from "@/hooks/queries";
import { useBudgetMutations } from "@/hooks/mutations";
import { useMonth } from "@/hooks/use-month";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { Card, EmptyState, Progress, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { CategoryIcon } from "@/lib/icons";
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
    .sort((a, b) => (b.budget || b.spent) - (a.budget || a.spent));
  const totalBudget = sumCents(rows.map((r) => r.budget));
  const totalSpent = sumCents(rows.map((r) => r.spent));
  const used = percentOf(totalSpent, totalBudget);

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
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-xl font-bold md:text-2xl">Orçamento</h1><p className="hidden text-sm text-muted md:block">Defina um limite por categoria e acompanhe.</p></div>
        <MonthSwitcher month={month} onChange={setMonth} />
      </header>

      <Card className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Gasto no mês</p>
            <p className="tnum text-3xl font-bold">{money(totalSpent)}</p>
            <p className="text-sm text-muted">de {money(totalBudget)} planejado</p>
          </div>
          <Button variant="outline" size="sm" loading={mutations.copy.isPending} onClick={copyPrevious}><Copy className="size-4" /> Copiar mês anterior</Button>
        </div>
        <Progress className="mt-4 h-3" value={used} tone={used > 100 ? "expense" : used > 85 ? "warn" : "brand"} />
        <p className="mt-2 text-sm">
          {totalBudget === 0 ? <span className="text-muted">Toque em uma categoria para definir o limite.</span>
            : totalBudget - totalSpent >= 0 ? <>Restam <b className="tnum text-income">{money(totalBudget - totalSpent)}</b> ({pct(100 - used)})</>
            : <>Estourou em <b className="tnum text-expense">{money(totalSpent - totalBudget)}</b></>}
        </p>
      </Card>

      <Card className="divide-y divide-border overflow-hidden">
        {isLoading && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>}
        {!isLoading && rows.length === 0 && <EmptyState icon={<Target className="size-6" />} title="Sem categorias de despesa" />}
        {rows.map(({ c, budget, spent }) => {
          const ratio = percentOf(spent, budget);
          const over = budget > 0 && spent > budget;
          return (
            <button key={c.id} onClick={() => setEditing(c)} className="block w-full px-4 py-3 text-left transition hover:bg-surface-2/60">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: c.color }}><CategoryIcon name={c.icon} className="size-4" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                <span className="tnum text-right text-sm">
                  <span className={cn("font-semibold", over && "text-expense")}>{money(spent)}</span>
                  <span className="text-muted"> / {budget ? money(budget) : "definir"}</span>
                </span>
              </div>
              {budget > 0 && <Progress className="mt-2" value={ratio} tone={over ? "expense" : ratio > 85 ? "warn" : "brand"} />}
            </button>
          );
        })}
      </Card>

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
          {error && <p role="alert" className="rounded-lg bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p>}
          <Button className="w-full" size="lg" loading={saving} onClick={() => onSave(cents)}>Salvar limite</Button>
        </div>
      }>
      <div className="space-y-3 pt-1">
        <MoneyInput large value={cents} onChange={setCents} autoFocus />
        <p className="text-sm text-muted">Gasto neste mês: <b className="tnum text-fg">{money(spent)}</b>. Deixe em R$ 0,00 para remover o limite.</p>
      </div>
    </Sheet>
  );
}
