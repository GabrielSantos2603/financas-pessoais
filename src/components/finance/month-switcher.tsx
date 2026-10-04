"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonthKey, monthLabel, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/cn";

export function MonthSwitcher({ month, onChange, className }: { month: string; onChange: (m: string) => void; className?: string }) {
  const isCurrent = month === currentMonthKey();
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button aria-label="Mês anterior" onClick={() => onChange(shiftMonth(month, -1))} className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg active:scale-90">
        <ChevronLeft className="size-5" />
      </button>
      <button
        onClick={() => onChange(currentMonthKey())}
        title={isCurrent ? undefined : "Voltar para o mês atual"}
        className="min-w-36 rounded-lg px-2 py-1 text-center text-base font-semibold md:min-w-44 md:text-lg"
      >
        {monthLabel(month)}
        {!isCurrent && <span className="block text-[11px] font-medium text-brand">ir para hoje</span>}
      </button>
      <button aria-label="Próximo mês" onClick={() => onChange(shiftMonth(month, 1))} className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg active:scale-90">
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
