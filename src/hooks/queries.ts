"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/components/app-context";
import { monthFirstDay, monthRange } from "@/lib/dates";
import { listBudgets } from "@/services/budgets";
import { listMembers } from "@/services/household";
import { listRules, materializeMonth } from "@/services/recurring";
import { fetchRefs } from "@/services/refs";
import { categoryTotals, periodSummary, personTotals } from "@/services/reports";
import { listInstallmentGroups, listTransactions } from "@/services/transactions";
import { getDb } from "./db";
import { keys } from "./keys";

export function useRefs() {
  const { household } = useApp();
  const q = useQuery({ queryKey: keys.refs(household.id), staleTime: 5 * 60_000, queryFn: () => fetchRefs(getDb()) });
  const data = q.data;
  return useMemo(() => {
    const people = data?.people ?? [];
    const accounts = data?.accounts ?? [];
    const categories = data?.categories ?? [];
    return {
      loading: q.isLoading,
      people, accounts, categories,
      personById: new Map(people.map((p) => [p.id, p])),
      accountById: new Map(accounts.map((a) => [a.id, a])),
      categoryById: new Map(categories.map((c) => [c.id, c])),
    };
  }, [data, q.isLoading]);
}

export function useTransactions(from: string, to: string) {
  const { household } = useApp();
  return useQuery({
    queryKey: keys.txRange(household.id, from, to),
    placeholderData: (prev) => prev,
    queryFn: () => listTransactions(getDb(), from, to),
  });
}

export function useMonthTransactions(month: string) {
  const { from, to } = monthRange(month);
  return useTransactions(from, to);
}

/** Uma linha por mês (agregado no banco). */
export function usePeriodSummary(from: string, to: string) {
  const { household } = useApp();
  return useQuery({
    queryKey: keys.summary(household.id, from, to),
    placeholderData: (prev) => prev,
    queryFn: () => periodSummary(getDb(), from, to),
  });
}

export function useCategoryTotals(from: string, to: string) {
  const { household } = useApp();
  return useQuery({
    queryKey: keys.categoryTotals(household.id, from, to),
    placeholderData: (prev) => prev,
    queryFn: () => categoryTotals(getDb(), from, to),
  });
}

export function usePersonTotals(from: string, to: string) {
  const { household } = useApp();
  return useQuery({
    queryKey: keys.personTotals(household.id, from, to),
    placeholderData: (prev) => prev,
    queryFn: () => personTotals(getDb(), from, to),
  });
}

export function useInstallmentGroups() {
  const { household } = useApp();
  return useQuery({ queryKey: keys.installments(household.id), queryFn: () => listInstallmentGroups(getDb()) });
}

export function useRecurring() {
  const { household } = useApp();
  return useQuery({ queryKey: keys.recurring(household.id), queryFn: () => listRules(getDb()) });
}

export function useBudgets(month: string) {
  const { household } = useApp();
  return useQuery({
    queryKey: keys.budgets(household.id, month),
    queryFn: () => listBudgets(getDb(), monthFirstDay(month)),
  });
}

export function useMembers() {
  const { household } = useApp();
  return useQuery({ queryKey: keys.members(household.id), queryFn: () => listMembers(getDb()) });
}

/** Gera os fixos do mês aberto (uma vez por sessão/mês) e recarrega os dados se algo foi criado. */
export function useMaterializeRecurring(month: string) {
  const qc = useQueryClient();
  const { household } = useApp();
  const done = useRef(new Set<string>());
  useEffect(() => {
    const key = `${household.id}:${month}`;
    if (done.current.has(key)) return;
    done.current.add(key);
    materializeMonth(getDb(), monthFirstDay(month))
      .then((created) => { if (created > 0) qc.invalidateQueries({ queryKey: keys.tx(household.id) }); })
      .catch(() => done.current.delete(key)); // tenta de novo na próxima visita
  }, [month, household.id, qc]);
}
