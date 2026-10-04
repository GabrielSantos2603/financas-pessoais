"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonthKey, monthLabelCompact, monthShort, shiftMonth } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/ui/sheet";

/** Seletor de mês em "pílula": setas para navegar e toque no nome para escolher qualquer mês/ano. */
export function MonthSwitcher({ month, onChange, className }: { month: string; onChange: (m: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const isCurrent = month === currentMonthKey();
  return (
    <>
      <div className={cn("flex items-center rounded-full border border-border bg-surface p-0.5 shadow-[var(--shadow-card)]", className)}>
        <button aria-label="Mês anterior" onClick={() => onChange(shiftMonth(month, -1))} className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg active:scale-90">
          <ChevronLeft className="size-5" />
        </button>
        <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="min-w-[7.5rem] px-1 text-center text-sm font-semibold leading-tight md:min-w-36">
          {monthLabelCompact(month)}
          {!isCurrent && <span className="block text-[10px] font-medium text-brand">outro mês</span>}
        </button>
        <button aria-label="Próximo mês" onClick={() => onChange(shiftMonth(month, 1))} className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg active:scale-90">
          <ChevronRight className="size-5" />
        </button>
      </div>
      {open && <MonthPicker month={month} onPick={(m) => { onChange(m); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}

function MonthPicker({ month, onPick, onClose }: { month: string; onPick: (m: string) => void; onClose: () => void }) {
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const current = currentMonthKey();
  return (
    <Sheet open onClose={onClose} title="Escolher mês" width="24rem">
      <div className="space-y-4 pb-2 pt-1">
        <div className="flex items-center justify-between">
          <button aria-label="Ano anterior" onClick={() => setYear(year - 1)} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><ChevronLeft className="size-5" /></button>
          <span className="text-lg font-bold tnum">{year}</span>
          <button aria-label="Próximo ano" onClick={() => setYear(year + 1)} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><ChevronRight className="size-5" /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).map((key) => {
            const active = key === month;
            return (
              <button
                key={key} onClick={() => onPick(key)} aria-pressed={active}
                className={cn(
                  "h-12 rounded-2xl text-sm font-semibold capitalize transition active:scale-95",
                  active ? "brand-gradient text-white shadow-md" : key === current ? "bg-brand-soft text-brand" : "bg-surface-2 text-fg hover:bg-brand-soft",
                )}
              >
                {monthShort(key)}
              </button>
            );
          })}
        </div>
        <button onClick={() => onPick(current)} className="h-11 w-full rounded-2xl text-sm font-semibold text-brand hover:bg-brand-soft">Ir para o mês atual</button>
      </div>
    </Sheet>
  );
}
