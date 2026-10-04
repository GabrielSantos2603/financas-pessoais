"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, Repeat as RepeatIcon, Trash2, X } from "lucide-react";
import { useRefs, useTransactions } from "@/hooks/queries";
import { useDeleteTransaction, useSaveTransaction } from "@/hooks/mutations";
import { addDaysToDate, currentMonthKey, monthFirstDay, monthRange, shiftMonth, today } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { CategoryBadge } from "@/components/finance/category-badge";
import { planInstallments } from "@/domain/installments";
import { validateDraft, type Repeat, type TxDraft } from "@/domain/draft";
import type { Scope } from "@/services/db";
import type { Kind, Transaction } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Chip, Field, MoneyInput, Segmented, Switch, inputCls } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";

type OpenOpts = { tx?: Transaction; kind?: Kind; date?: string } | undefined;
const Ctx = createContext<{ open: (o?: OpenOpts) => void }>({ open: () => {} });
export const useTxSheet = () => useContext(Ctx);

export function TxSheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: OpenOpts; key: number } | null>(null);
  const open = useCallback((o?: OpenOpts) => setState({ opts: o, key: Date.now() }), []);
  const close = useCallback(() => setState(null), []);

  // Atalho "N" abre um novo lançamento (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state && <TxForm key={state.key} opts={state.opts} onClose={close} />}
    </Ctx.Provider>
  );
}

const LS = { person: "last_person", account: "last_account" };
const ls = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

function TxForm({ opts, onClose }: { opts: OpenOpts; onClose: () => void }) {
  const editing = opts?.tx;
  const toast = useToast();
  const refs = useRefs();
  const save = useSaveTransaction();
  const del = useDeleteTransaction();
  const history = useTransactions(monthFirstDay(shiftMonth(currentMonthKey(), -6)), monthRange(currentMonthKey()).to);

  const [kind, setKind] = useState<Kind>(editing?.kind ?? opts?.kind ?? "expense");
  const [amountCents, setAmountCents] = useState(editing?.amount_cents ?? 0);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [date, setDate] = useState(editing?.due_date ?? opts?.date ?? today());
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  // undefined = ainda não escolhido: usa a última pessoa/conta usadas (ou a primeira pessoa).
  const [personPick, setPersonId] = useState<string | null | undefined>(editing ? editing.person_id : undefined);
  const [accountPick, setAccountId] = useState<string | null | undefined>(editing ? editing.account_id : undefined);
  const lastPerson = ls(LS.person);
  const lastAccount = ls(LS.account);
  const personId = personPick !== undefined ? personPick
    : lastPerson && refs.personById.has(lastPerson) ? lastPerson : refs.people[0]?.id ?? null;
  const accountId = accountPick !== undefined ? accountPick
    : lastAccount && refs.accountById.has(lastAccount) ? lastAccount : null;
  const [done, setDone] = useState(editing ? editing.status === "done" : false);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [total, setTotal] = useState(2);
  const [current, setCurrent] = useState(1);
  const [amountIsTotal, setAmountIsTotal] = useState(false);
  const [scope, setScope] = useState<Scope>("one");
  const [confirmDel, setConfirmDel] = useState(false);
  const [touchedCat, setTouchedCat] = useState(!!editing);
  const [error, setError] = useState("");

  const busy = save.isPending || del.isPending;
  const isInstallment = !!editing?.installment_group;
  const cats = useMemo(() => refs.categories.filter((c) => c.kind === kind && !c.archived), [refs.categories, kind]);

  // Sugestões a partir do histórico (últimos 6 meses), mais recentes primeiro.
  const suggestions = useMemo(() => {
    const seen = new Map<string, Transaction>();
    [...(history.data ?? [])].reverse().forEach((t) => {
      if (t.kind === kind && !seen.has(t.description.toLowerCase())) seen.set(t.description.toLowerCase(), t);
    });
    return [...seen.values()];
  }, [history.data, kind]);

  function onDescription(v: string) {
    setDescription(v);
    if (editing) return;
    const hit = suggestions.find((s) => s.description.toLowerCase() === v.trim().toLowerCase());
    if (hit) {
      if (!touchedCat && hit.category_id) setCategoryId(hit.category_id);
      if (!amountCents) setAmountCents(hit.amount_cents);
      if (hit.person_id) setPersonId(hit.person_id);
      if (hit.account_id) setAccountId(hit.account_id);
    }
  }

  function changeKind(k: Kind) {
    setKind(k);
    if (!touchedCat || (categoryId && refs.categoryById.get(categoryId)?.kind !== k)) { setCategoryId(null); setTouchedCat(false); }
  }

  const draft: TxDraft = {
    kind, description, amountCents, dueDate: date, done, personId, categoryId, accountId, notes, repeat,
    installments: { total, current, amountIsTotal },
  };

  function submit(addAnother = false) {
    const target = editing ? ({ mode: "update", tx: editing, scope } as const) : ({ mode: "create" } as const);
    const invalid = validateDraft(draft, target.mode);
    if (invalid) return setError(invalid);
    setError("");
    if (personId) lsSet(LS.person, personId);
    if (accountId) lsSet(LS.account, accountId);
    save.mutate({ draft, target }, {
      onSuccess: (message) => {
        toast(message);
        if (addAnother && !editing) { setDescription(""); setAmountCents(0); setNotes(""); setRepeat("none"); } else onClose();
      },
      onError: (e) => setError(e.message),
    });
  }

  function remove() {
    del.mutate({ tx: editing!, scope }, {
      onSuccess: (n) => { toast(n > 1 ? `${n} lançamentos excluídos` : "Lançamento excluído"); onClose(); },
      onError: (e) => { setError(e.message); setConfirmDel(false); },
    });
  }

  const doneLabel = kind === "income" ? "Já recebi" : "Já paguei";

  // Pré-visualização das parcelas (mesma regra do banco).
  const plan = useMemo(() => {
    if (repeat !== "installments" || amountCents <= 0) return null;
    try { return planInstallments({ amountCents, amountIsTotal, total, current }); } catch { return null; }
  }, [repeat, amountCents, amountIsTotal, total, current]);

  const expense = kind === "expense";
  const tone = expense ? "from-rose-500 to-rose-600" : "from-emerald-500 to-teal-600";
  const dateChips = [
    { label: "Hoje", value: today() },
    { label: "Ontem", value: addDaysToDate(today(), -1) },
    { label: "Amanhã", value: addDaysToDate(today(), 1) },
  ];

  return (
    <Sheet
      open onClose={onClose} title={editing ? "Editar lançamento" : "Novo lançamento"}
      top={
        <div className={cn("bg-gradient-to-br px-5 pb-5 pt-3 text-white transition-colors", tone)}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/40 md:hidden" />
          <div className="flex items-center justify-between gap-3">
            {editing ? (
              <h2 className="text-lg font-bold">Editar {expense ? "despesa" : "receita"}</h2>
            ) : (
              <div role="tablist" className="flex rounded-full bg-black/15 p-1">
                {([["expense", "Despesa"], ["income", "Receita"]] as const).map(([k, label]) => (
                  <button
                    key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => changeKind(k)}
                    className={cn("h-9 rounded-full px-5 text-sm font-semibold transition", kind === k ? "bg-white text-fg shadow" : "text-white/85 hover:text-white")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-full bg-black/15 transition hover:bg-black/25"><X className="size-5" /></button>
          </div>
          <p className="mt-5 text-sm font-medium text-white/85">{repeat === "installments" && amountIsTotal ? "Valor total" : repeat === "installments" ? "Valor da parcela" : "Valor"}</p>
          <MoneyInput hero value={amountCents} onChange={setAmountCents} autoFocus={!editing} />
        </div>
      }
      footer={
        <div className="space-y-2">
          {error && <p role="alert" className="rounded-xl bg-expense-soft px-3 py-2 text-sm font-medium text-expense">{error}</p>}
          {confirmDel ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm font-medium">Excluir {isInstallment && scope === "following" ? "esta e as próximas parcelas" : "este lançamento"}?</p>
              <Button variant="outline" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Button>
              <Button variant="danger" size="sm" loading={del.isPending} onClick={remove}>Excluir</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {editing && (
                <Button variant="outline" size="icon" className="size-12 rounded-2xl text-expense" aria-label="Excluir" onClick={() => setConfirmDel(true)}>
                  <Trash2 className="size-5" />
                </Button>
              )}
              {!editing && (
                <Button variant="soft" size="lg" className="hidden rounded-2xl md:inline-flex" disabled={busy} onClick={() => submit(true)}>Salvar e novo</Button>
              )}
              <Button className={cn("flex-1 rounded-2xl text-white", expense ? "!bg-rose-500" : "!bg-emerald-600")} size="lg" loading={save.isPending} disabled={busy} onClick={() => submit(false)}>
                <Check className="size-5" strokeWidth={3} /> {editing ? "Salvar alterações" : expense ? "Adicionar despesa" : "Adicionar receita"}
              </Button>
            </div>
          )}
        </div>
      }
    >
      <form className="space-y-5 pt-3" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <Field label="Descrição">
          {(id) => (
            <>
              <input
                id={id} list="desc-suggestions" value={description} onChange={(e) => onDescription(e.target.value)}
                placeholder={kind === "income" ? "Ex.: Salário, Projeto..." : "Ex.: Supermercado, Aluguel..."}
                className={cn(inputCls, "h-12 rounded-2xl text-base")} autoComplete="off" enterKeyHint="done" maxLength={200}
              />
              <datalist id="desc-suggestions">{suggestions.map((s) => <option key={s.id} value={s.description} />)}</datalist>
            </>
          )}
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Quando</p>
          <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5">
            {dateChips.map((c) => <Chip key={c.label} active={date === c.value} onClick={() => setDate(c.value)}>{c.label}</Chip>)}
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data"
              className={cn("h-9 shrink-0 rounded-full border bg-surface px-3 text-sm font-medium", dateChips.some((c) => c.value === date) ? "border-border text-muted" : "border-brand bg-brand-soft text-brand")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Categoria</p>
          <div className="grid grid-cols-4 gap-1.5">
            {cats.map((c) => {
              const active = c.id === categoryId;
              return (
                <button
                  key={c.id} type="button" aria-pressed={active}
                  onClick={() => { setCategoryId(active ? null : c.id); setTouchedCat(true); }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-2 text-center text-[11px] font-semibold leading-tight transition active:scale-95",
                    active ? "border-brand bg-brand-soft text-brand" : "border-transparent text-muted hover:bg-surface-2",
                  )}
                >
                  <CategoryBadge icon={c.icon} color={c.color} size="sm" />
                  <span className="line-clamp-2">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Quem?</p>
            <div className="flex flex-wrap gap-2">
              {refs.people.filter((p) => !p.archived).map((p) => (
                <Chip key={p.id} color={p.color} active={p.id === personId} onClick={() => setPersonId(p.id === personId ? null : p.id)}>{p.name}</Chip>
              ))}
            </div>
          </div>
          <Field label="Conta / cartão">
            {(id) => (
              <select id={id} value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value || null)} className={cn(inputCls, "rounded-xl")}>
                <option value="">Sem conta</option>
                {refs.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3.5">
          <span>
            <span className="block text-sm font-semibold">{doneLabel}</span>
            <span className="block text-xs text-muted">{done ? (kind === "income" ? "Marcado como recebido" : "Marcado como pago") : "Fica como pendente até você marcar"}</span>
          </span>
          <Switch checked={done} onChange={setDone} label={doneLabel} />
        </div>

        {isInstallment && (
          <div className="space-y-2 rounded-2xl border border-border p-3">
            <p className="text-sm font-semibold">Parcela {editing!.installment_number}/{editing!.installment_total}</p>
            <Segmented<Scope>
              value={scope} onChange={setScope}
              options={[{ value: "one", label: "Só esta" }, { value: "following", label: "Esta e as próximas" }]}
            />
          </div>
        )}

        {!editing && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted">Repetição</p>
            <Segmented<Repeat>
              value={repeat} onChange={setRepeat}
              options={[{ value: "none", label: "Única" }, { value: "installments", label: "Parcelada" }, { value: "monthly", label: "Fixa mensal" }]}
            />
            {repeat === "installments" && (
              <div className="space-y-3 rounded-2xl border border-border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nº de parcelas">
                    {() => <Stepper value={total} min={2} max={120} onChange={(v) => { setTotal(v); setCurrent((c) => Math.min(c, v)); }} />}
                  </Field>
                  <Field label="Parcela atual">
                    {() => <Stepper value={current} min={1} max={total} onChange={setCurrent} />}
                  </Field>
                </div>
                <Segmented<"each" | "total">
                  value={amountIsTotal ? "total" : "each"} onChange={(v) => setAmountIsTotal(v === "total")}
                  options={[{ value: "each", label: "Valor da parcela" }, { value: "total", label: "Valor total" }]}
                />
                {plan && (
                  <p className="text-sm text-muted">
                    {plan.amounts.length}× de <b className="text-fg">{money(plan.amounts[plan.amounts.length - 1])}</b>
                    {plan.amounts[0] !== plan.amounts[plan.amounts.length - 1] && <> (as primeiras, {money(plan.amounts[0])})</>}
                    {" "}— {current > 1 ? `da ${current}ª à ${total}ª parcela` : `total ${money(plan.purchaseTotal)}`}
                  </p>
                )}
              </div>
            )}
            {repeat === "monthly" && (
              <p className="flex items-start gap-2 rounded-2xl bg-brand-soft p-3 text-sm text-brand">
                <RepeatIcon className="mt-0.5 size-4 shrink-0" />
                Será lançado todo mês no dia {Number(date.slice(8, 10)) || "—"}. Você pode ajustar o valor de cada mês depois.
              </p>
            )}
          </div>
        )}

        <Field label="Observação (opcional)">
          {(id) => <textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={cn(inputCls, "h-auto rounded-2xl py-2.5")} />}
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex h-11 items-center rounded-xl border border-border bg-surface">
      <button type="button" aria-label="Diminuir" disabled={value <= min} onClick={() => onChange(value - 1)} className="grid size-11 place-items-center text-muted disabled:opacity-30"><Minus className="size-4" /></button>
      <span className="tnum flex-1 text-center font-semibold">{value}</span>
      <button type="button" aria-label="Aumentar" disabled={value >= max} onClick={() => onChange(value + 1)} className="grid size-11 place-items-center text-muted disabled:opacity-30"><Plus className="size-4" /></button>
    </div>
  );
}
