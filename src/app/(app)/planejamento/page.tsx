"use client";

import { useState } from "react";
import { CalendarClock, Layers, Plus, Repeat, Trash2 } from "lucide-react";
import { useInstallmentGroups, useRecurring, useRefs } from "@/hooks/queries";
import { useRuleMutations } from "@/hooks/mutations";
import { useTxSheet } from "@/components/finance/tx-sheet";
import { CategoryBadge } from "@/components/finance/category-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Money } from "@/components/ui/money";
import { Card, EmptyState, Progress, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, Field, MoneyInput, Segmented, Switch, inputCls } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { currentMonthKey, monthFirstDay, monthLabel, today } from "@/lib/dates";
import { money } from "@/lib/format";
import { sumCents } from "@/domain/money";
import { cn } from "@/lib/cn";
import type { Kind, RecurringRule } from "@/types/db";

export default function PlanejamentoPage() {
  const [tab, setTab] = useState<"fixos" | "parcelas">("fixos");
  return (
    <div className="pb-4">
      <PageHeader title="Planejamento" subtitle="Gastos fixos que se repetem e compras parceladas em andamento" />
      <div className="mt-4 space-y-5 md:mt-0 md:space-y-6">
        <Segmented value={tab} onChange={setTab} className="md:w-80" options={[{ value: "fixos", label: "Fixos mensais" }, { value: "parcelas", label: "Parcelas" }]} />
        {tab === "fixos" ? <Fixos /> : <Parcelas />}
      </div>
    </div>
  );
}

/* ---------------- Parcelas ---------------- */
function Parcelas() {
  const { data: groups = [], isLoading } = useInstallmentGroups();
  const refs = useRefs();
  const { open } = useTxSheet();

  const active = groups.filter((g) => g.pending_count > 0);
  const finished = groups.filter((g) => g.pending_count === 0);
  const totalRemaining = sumCents(active.map((g) => g.remaining_cents));

  if (isLoading) return <Skeleton className="h-40 rounded-[22px]" />;
  if (!groups.length)
    return <Card><EmptyState icon={<Layers className="size-6" />} title="Nenhuma compra parcelada" hint="Ao criar um lançamento, escolha “Parcelada” para acompanhar cada parcela aqui." action={<Button onClick={() => open()}><Plus className="size-5" /> Novo lançamento</Button>} /></Card>;

  return (
    <>
      <section className="brand-gradient relative overflow-hidden rounded-[28px] p-5 text-white shadow-[var(--shadow-float)] md:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm font-medium text-white/80">Ainda a pagar em parcelas</p>
        <Money cents={totalRemaining} className="mt-1 block text-4xl font-bold tracking-tight" />
        <p className="mt-1 text-sm text-white/75">{active.length} {active.length === 1 ? "compra ativa" : "compras ativas"}</p>
      </section>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        {[...active, ...finished].map((g) => {
          const cat = g.category_id ? refs.categoryById.get(g.category_id) : undefined;
          const isActive = g.pending_count > 0;
          // parcelas já pagas = as anteriores à próxima pendente (inclui as pagas antes de usar o app)
          const paid = isActive ? (g.focus.installment_number ?? 1) - 1 : g.total;
          return (
            <Card key={g.group_id} className={cn("p-4", !isActive && "opacity-60")}>
              <button className="flex w-full items-center gap-3 text-left" onClick={() => open({ tx: g.focus })}>
                <CategoryBadge icon={cat?.icon} color={cat?.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{g.description}</span>
                  <span className="block text-xs text-muted">{isActive ? `Próxima: ${g.focus.installment_number}/${g.total} · ${money(g.focus.amount_cents)}` : "Quitado ✔"}</span>
                </span>
                <span className="text-right"><Money cents={g.remaining_cents} className="block text-[15px] font-bold" /><span className="block text-[11px] text-muted">restante</span></span>
              </button>
              <Progress className="mt-3.5" value={(paid / g.total) * 100} tone={isActive ? "brand" : "income"} />
              <p className="mt-1.5 text-xs text-muted">{paid} de {g.total} pagas{isActive ? ` · termina em ${monthLabel(g.last_due.slice(0, 7)).toLowerCase()}` : ""}</p>
            </Card>
          );
        })}
      </div>
    </>
  );
}

/* ---------------- Fixos ---------------- */
function Fixos() {
  const { data = [], isLoading } = useRecurring();
  const refs = useRefs();
  const [editing, setEditing] = useState<Partial<RecurringRule> | null>(null);

  const income = data.filter((r) => r.kind === "income" && r.active);
  const expense = data.filter((r) => r.kind === "expense" && r.active);
  const sum = (l: RecurringRule[]) => sumCents(l.map((r) => r.amount_cents));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><p className="text-xs font-medium text-muted">Receitas fixas / mês</p><Money cents={sum(income)} className="mt-1 block text-xl font-bold text-income" /></Card>
        <Card className="p-4"><p className="text-xs font-medium text-muted">Despesas fixas / mês</p><Money cents={sum(expense)} className="mt-1 block text-xl font-bold text-expense" /></Card>
      </div>
      <div className="flex justify-end">
        <Button variant="soft" onClick={() => setEditing({ kind: "expense", day_of_month: 5, amount_cents: 0, active: true })}>
          <Plus className="size-5" /> Novo fixo
        </Button>
      </div>
      <Card className="divide-y divide-border/70 overflow-hidden">
        {isLoading && <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {!isLoading && !data.length && <EmptyState icon={<Repeat className="size-6" />} title="Nenhum lançamento fixo" hint="Aluguel, salário, internet... cadastre uma vez e o app lança todo mês." />}
        {data.map((r) => {
          const cat = r.category_id ? refs.categoryById.get(r.category_id) : undefined;
          return (
            <button key={r.id} onClick={() => setEditing(r)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/50 md:px-5", !r.active && "opacity-50")}>
              <CategoryBadge icon={cat?.icon} color={cat?.color} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{r.description}</span>
                <span className="block text-xs text-muted">Todo dia {r.day_of_month}{r.person_id ? ` · ${refs.personById.get(r.person_id)?.name}` : ""}{!r.active ? " · pausado" : ""}</span>
              </span>
              <Money cents={r.amount_cents} sign={r.kind === "income"} className={cn("text-[15px] font-bold", r.kind === "income" ? "text-income" : "text-fg")} />
            </button>
          );
        })}
      </Card>
      {editing && <RuleSheet rule={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function RuleSheet({ rule, onClose }: { rule: Partial<RecurringRule>; onClose: () => void }) {
  const refs = useRefs();
  const toast = useToast();
  const { create, update, remove } = useRuleMutations();
  const [f, setF] = useState({
    kind: (rule.kind ?? "expense") as Kind, description: rule.description ?? "", amountCents: rule.amount_cents ?? 0,
    day: rule.day_of_month ?? 5, personId: rule.person_id ?? null, categoryId: rule.category_id ?? null, active: rule.active ?? true,
  });
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const busy = create.isPending || update.isPending || remove.isPending;
  const cats = refs.categories.filter((c) => c.kind === f.kind && !c.archived);

  const done = (message: string) => ({ onSuccess: () => { toast(message); onClose(); }, onError: (e: Error) => setError(e.message) });

  function save() {
    if (!f.description.trim()) return setError("Informe uma descrição.");
    setError("");
    if (rule.id) {
      update.mutate({
        id: rule.id, description: f.description, amountCents: f.amountCents, day: f.day, personId: f.personId,
        categoryId: f.categoryId, accountId: rule.account_id ?? null, active: f.active, fromMonth: monthFirstDay(currentMonthKey()),
      }, done("Fixo salvo"));
    } else {
      create.mutate({
        kind: f.kind, description: f.description, amountCents: f.amountCents, day: f.day, startMonth: monthFirstDay(currentMonthKey()),
        personId: f.personId, categoryId: f.categoryId, accountId: null, today: today(),
      }, done("Fixo criado"));
    }
  }

  return (
    <Sheet open onClose={onClose} title={rule.id ? "Editar fixo" : "Novo fixo mensal"}
      footer={
        <div className="space-y-2">
          {error && <p role="alert" className="rounded-xl bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          {confirm ? (
            <div className="flex items-center gap-2"><p className="flex-1 text-sm font-medium">Remover e apagar os meses futuros pendentes?</p>
              <Button variant="outline" size="sm" onClick={() => setConfirm(false)}>Não</Button>
              <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate({ id: rule.id!, from: today() }, done("Fixo removido"))}>Remover</Button></div>
          ) : (
            <div className="flex gap-2">
              {rule.id && <Button variant="outline" size="icon" className="size-12 rounded-2xl text-expense" aria-label="Remover" onClick={() => setConfirm(true)}><Trash2 className="size-5" /></Button>}
              <Button className="flex-1 rounded-2xl" size="lg" loading={busy} onClick={save}>Salvar</Button>
            </div>
          )}
        </div>
      }>
      <div className="space-y-4 pt-2">
        {!rule.id && <Segmented<Kind> value={f.kind} onChange={(kind) => setF({ ...f, kind, categoryId: null })} options={[{ value: "expense", label: "Despesa", tone: "expense" }, { value: "income", label: "Receita", tone: "income" }]} />}
        <Field label="Descrição">{(id) => <input id={id} value={f.description} maxLength={200} onChange={(e) => setF({ ...f, description: e.target.value })} className={cn(inputCls, "h-12 rounded-2xl")} placeholder="Ex.: Aluguel" />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">{(id) => <MoneyInput id={id} value={f.amountCents} onChange={(amountCents) => setF({ ...f, amountCents })} />}</Field>
          <Field label="Dia do mês">{(id) => <input id={id} type="number" min={1} max={31} value={f.day} onChange={(e) => setF({ ...f, day: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} className={inputCls} />}</Field>
        </div>
        <Field label="Categoria">
          {(id) => <select id={id} value={f.categoryId ?? ""} onChange={(e) => setF({ ...f, categoryId: e.target.value || null })} className={inputCls}><option value="">Sem categoria</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        </Field>
        <div className="space-y-2"><p className="text-xs font-medium text-muted">Quem?</p>
          <div className="flex flex-wrap gap-2">{refs.people.filter((p) => !p.archived).map((p) => <Chip key={p.id} color={p.color} active={p.id === f.personId} onClick={() => setF({ ...f, personId: p.id === f.personId ? null : p.id })}>{p.name}</Chip>)}</div></div>
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3.5"><span className="text-sm font-semibold">Ativo (lançar todo mês)</span><Switch checked={f.active} onChange={(active) => setF({ ...f, active })} label="Ativo" /></div>
        <p className="flex items-start gap-2 text-xs text-muted"><CalendarClock className="mt-0.5 size-3.5 shrink-0" />Alterações valem para os meses futuros ainda pendentes. Meses já pagos não mudam.</p>
      </div>
    </Sheet>
  );
}
