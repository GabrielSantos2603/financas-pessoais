"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/components/app-context";
import { useToast } from "@/components/ui/toast";
import { today } from "@/lib/dates";
import type { ImportRow } from "@/domain/import-xlsx";
import type { TxDraft } from "@/domain/draft";
import type { Transaction } from "@/types/db";
import type { Scope } from "@/services/db";
import { setBudget, copyBudgets } from "@/services/budgets";
import { leaveHousehold, removeMember, rotateInviteCode } from "@/services/household";
import { createRule, deleteRule, updateRule, type RuleCreate, type RuleEdit } from "@/services/recurring";
import { deleteEntity, saveAccount, saveCategory, savePerson, type AccountInput, type CategoryInput, type PersonInput } from "@/services/refs";
import { importRows, removeTransaction, saveDraft, setStatus, type SaveTarget } from "@/services/transactions";
import { getDb } from "./db";
import { keys } from "./keys";

export function useInvalidate() {
  const qc = useQueryClient();
  const { household: { id } } = useApp();
  return {
    tx: () => qc.invalidateQueries({ queryKey: keys.tx(id) }),
    recurring: () => qc.invalidateQueries({ queryKey: keys.recurring(id) }),
    refs: () => qc.invalidateQueries({ queryKey: keys.refs(id) }),
    budgets: () => qc.invalidateQueries({ queryKey: keys.budgetsAll(id) }),
    members: () => qc.invalidateQueries({ queryKey: keys.members(id) }),
  };
}

export function useSaveTransaction() {
  const { household } = useApp();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ draft, target }: { draft: TxDraft; target: SaveTarget }) =>
      saveDraft(getDb(), draft, target, { householdId: household.id, today: today() }),
    onSuccess: () => { inv.tx(); inv.recurring(); },
  });
}

export function useDeleteTransaction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ tx, scope }: { tx: Transaction; scope: Scope }) => removeTransaction(getDb(), tx, scope),
    onSuccess: () => inv.tx(),
  });
}

/** Marca pago/recebido com atualização otimista (a tela responde na hora) e opção de desfazer. */
export function useToggleStatus() {
  const qc = useQueryClient();
  const { household } = useApp();
  const toast = useToast();

  const apply = useCallback(
    (id: string, status: Transaction["status"]) => {
      const settled_at = status === "done" ? today() : null;
      const lists = keys.txLists(household.id);
      const snapshots = qc.getQueriesData<Transaction[]>({ queryKey: lists });
      qc.setQueriesData<Transaction[]>({ queryKey: lists }, (old) => old?.map((t) => (t.id === id ? { ...t, status, settled_at } : t)));
      setStatus(getDb(), id, status, today())
        .catch((e: Error) => {
          snapshots.forEach(([k, d]) => qc.setQueryData(k, d));
          toast(e.message, { tone: "error" });
        })
        // sempre reconcilia com o servidor (resumos e rankings dependem do status)
        .finally(() => qc.invalidateQueries({ queryKey: keys.tx(household.id) }));
    },
    [household.id, qc, toast],
  );

  return useCallback(
    (tx: Transaction) => {
      const next = tx.status === "done" ? "pending" : "done";
      apply(tx.id, next);
      const verb = next === "pending" ? "pendente" : tx.kind === "income" ? "recebido" : "pago";
      toast(`${tx.description} · ${verb}`, { action: { label: "Desfazer", run: () => apply(tx.id, tx.status) } });
    },
    [apply, toast],
  );
}

export function useImportRows() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (rows: readonly ImportRow[]) => importRows(getDb(), rows),
    onSuccess: () => { inv.tx(); inv.refs(); },
  });
}

export function useRuleMutations() {
  const inv = useInvalidate();
  const onSuccess = () => { inv.recurring(); inv.tx(); };
  return {
    create: useMutation({ mutationFn: (r: RuleCreate) => createRule(getDb(), r), onSuccess }),
    update: useMutation({ mutationFn: (r: RuleEdit) => updateRule(getDb(), r), onSuccess }),
    remove: useMutation({ mutationFn: ({ id, from }: { id: string; from: string }) => deleteRule(getDb(), id, from), onSuccess }),
  };
}

export function useBudgetMutations() {
  const { household } = useApp();
  const inv = useInvalidate();
  return {
    set: useMutation({
      mutationFn: (v: { categoryId: string; monthFirstDay: string; amountCents: number }) =>
        setBudget(getDb(), household.id, v.categoryId, v.monthFirstDay, v.amountCents),
      onSuccess: () => inv.budgets(),
    }),
    copy: useMutation({
      mutationFn: (v: { from: string; to: string }) => copyBudgets(getDb(), v.from, v.to),
      onSuccess: () => inv.budgets(),
    }),
  };
}

export function useEntityMutations() {
  const { household } = useApp();
  const inv = useInvalidate();
  const onSuccess = () => { inv.refs(); };
  return {
    savePerson: useMutation({ mutationFn: (v: PersonInput) => savePerson(getDb(), household.id, v), onSuccess }),
    saveAccount: useMutation({ mutationFn: (v: AccountInput) => saveAccount(getDb(), household.id, v), onSuccess }),
    saveCategory: useMutation({ mutationFn: (v: CategoryInput) => saveCategory(getDb(), household.id, v), onSuccess }),
    remove: useMutation({
      mutationFn: (v: { table: "people" | "accounts" | "categories"; id: string }) => deleteEntity(getDb(), v.table, v.id),
      onSuccess: () => { inv.refs(); inv.tx(); inv.budgets(); inv.recurring(); },
    }),
  };
}

export function useHouseholdMutations() {
  const inv = useInvalidate();
  return {
    rotate: useMutation({ mutationFn: () => rotateInviteCode(getDb()) }),
    removeMember: useMutation({ mutationFn: (userId: string) => removeMember(getDb(), userId), onSuccess: () => inv.members() }),
    leave: useMutation({ mutationFn: () => leaveHousehold(getDb()) }),
  };
}
