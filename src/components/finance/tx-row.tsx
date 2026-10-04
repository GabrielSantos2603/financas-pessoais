"use client";

import { Check, Repeat } from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import { daysUntil, shortDate, today } from "@/lib/dates";
import type { Category, Person, Transaction } from "@/types/db";

export function TxRow({
  tx, category, person, onOpen, onToggle, showDate,
}: {
  tx: Transaction; category?: Category; person?: Person;
  onOpen: (t: Transaction) => void; onToggle: (t: Transaction) => void; showDate?: boolean;
}) {
  const income = tx.kind === "income";
  const done = tx.status === "done";
  const overdue = !done && tx.due_date < today();
  const soon = !done && !overdue && daysUntil(tx.due_date) <= 3;
  const sub = [
    showDate ? shortDate(tx.due_date) : null,
    category?.name,
    person?.name,
    tx.installment_total ? `${tx.installment_number}/${tx.installment_total}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 transition hover:bg-surface-2/60 md:px-4">
      <button onClick={() => onOpen(tx)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Editar ${tx.description}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ background: category?.color ?? "#94a3b8" }}>
          <CategoryIcon name={category?.icon} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("flex items-center gap-1.5 truncate text-sm font-medium", done && "text-muted")}>
            <span className="truncate">{tx.description}</span>
            {tx.recurring_id && <Repeat className="size-3 shrink-0 text-muted" aria-label="Fixo mensal" />}
          </span>
          <span className="block truncate text-xs text-muted">
            {sub}
            {overdue && <span className="ml-1.5 rounded bg-expense-soft px-1.5 py-0.5 font-semibold text-expense">Atrasado</span>}
            {soon && <span className="ml-1.5 rounded bg-warn-soft px-1.5 py-0.5 font-semibold text-warn">Vence em breve</span>}
          </span>
        </span>
        <span className={cn("tnum shrink-0 text-sm font-semibold", done ? "text-muted" : income ? "text-income" : "text-fg")}>
          {income ? "+" : "−"} {money(tx.amount_cents)}
        </span>
      </button>
      <button
        onClick={() => onToggle(tx)}
        aria-label={done ? (income ? "Marcar como não recebido" : "Marcar como não pago") : (income ? "Marcar como recebido" : "Marcar como pago")}
        aria-pressed={done}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border-2 transition active:scale-90",
          done ? "border-income bg-income text-white" : "border-border text-transparent hover:border-income hover:text-income/60",
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>
    </div>
  );
}
