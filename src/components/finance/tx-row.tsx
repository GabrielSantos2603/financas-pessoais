"use client";

import { useRef, useState } from "react";
import { Check, Repeat } from "lucide-react";
import { cn } from "@/lib/cn";
import { Money } from "@/components/ui/money";
import { CategoryBadge } from "@/components/finance/category-badge";
import { dayParts, daysUntil } from "@/lib/dates";
import type { Category, Person, Transaction } from "@/types/db";

const SWIPE_TRIGGER = 84;

/** Situação de prazo para lançamentos pendentes: "Atrasado há 3 dias", "Vence hoje", "Vence amanhã". */
function dueHint(tx: Transaction): { text: string; tone: "bad" | "warn" } | null {
  if (tx.status === "done") return null;
  const d = daysUntil(tx.due_date);
  if (d < 0) return { text: d === -1 ? "Atrasado há 1 dia" : `Atrasado há ${-d} dias`, tone: "bad" };
  if (d === 0) return { text: "Vence hoje", tone: "warn" };
  if (d === 1) return { text: "Vence amanhã", tone: "warn" };
  return null;
}

export function TxRow({
  tx, category, person, onOpen, onToggle, showDate,
}: {
  tx: Transaction; category?: Category; person?: Person;
  onOpen: (t: Transaction) => void; onToggle: (t: Transaction) => void; showDate?: boolean;
}) {
  const income = tx.kind === "income";
  const done = tx.status === "done";
  const hint = dueHint(tx);

  // ── deslizar para a direita = marcar como pago/recebido (telas de toque) ──
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; id: number; axis: "x" | "y" | null } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const ddx = e.clientX - d.x, ddy = e.clientY - d.y;
    if (!d.axis && Math.hypot(ddx, ddy) > 8) d.axis = Math.abs(ddx) > Math.abs(ddy) * 1.4 ? "x" : "y";
    if (d.axis === "x") {
      moved.current = true;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(d.id);
      setDx(Math.max(0, Math.min(ddx, 140)));
    }
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.axis === "x" && dx >= SWIPE_TRIGGER) onToggle(tx);
    setDx(0);
    setDragging(false);
  };

  const sub = [category?.name, person?.name, tx.installment_total ? `${tx.installment_number}/${tx.installment_total}` : null].filter(Boolean).join(" · ");

  return (
    <div className="relative overflow-hidden">
      {/* fundo revelado pelo gesto */}
      <div className={cn("absolute inset-y-0 left-0 flex items-center gap-2 px-5 text-sm font-semibold text-white", done ? "bg-muted" : "bg-income")} style={{ width: Math.max(dx, 0) + 24 }} aria-hidden>
        <Check className={cn("size-5 transition-transform", dx >= SWIPE_TRIGGER && "scale-125")} strokeWidth={3} />
        {dx >= 64 && (done ? "Reabrir" : income ? "Recebido" : "Pago")}
      </div>

      <div
        className={cn("group relative flex items-center bg-surface py-3 transition-colors hover:bg-surface-2/50", showDate ? "gap-2.5 px-3.5" : "gap-3 px-4 md:px-5")}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)", touchAction: "pan-y" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end}
      >
        <button
          onClick={(e) => { if (moved.current) { e.preventDefault(); return; } onOpen(tx); }}
          className={cn("flex min-w-0 flex-1 items-center text-left", showDate ? "gap-2.5" : "gap-3")} aria-label={`Editar ${tx.description}`}
        >
          {showDate ? <DateChip date={tx.due_date} overdue={hint?.tone === "bad"} /> : <CategoryBadge icon={category?.icon} color={category?.color} />}
          <span className="min-w-0 flex-1">
            <span className={cn("flex items-center gap-1.5 font-semibold leading-tight", showDate ? "text-sm" : "text-[15px]", done && "text-muted")}>
              <span className="line-clamp-2">{tx.description}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {tx.recurring_id && <Repeat className="mr-1 inline size-3 align-[-1px]" aria-label="Fixo mensal" />}
              {sub || "Sem categoria"}
              {hint && <span className={cn("ml-1.5 font-semibold", hint.tone === "bad" ? "text-expense" : "text-warn")}>· {hint.text}</span>}
            </span>
          </span>
          <Money
            cents={tx.amount_cents} sign={income}
            className={cn("shrink-0 font-bold", showDate ? "text-sm" : "text-[15px]", done ? "text-muted" : income ? "text-income" : "text-fg")}
          />
        </button>
        <button
          onClick={() => onToggle(tx)}
          aria-label={done ? (income ? "Marcar como não recebido" : "Marcar como não pago") : (income ? "Marcar como recebido" : "Marcar como pago")}
          aria-pressed={done}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full border-2 transition active:scale-90",
            done ? "pop border-income bg-income text-white" : "border-border text-transparent hover:border-income hover:text-income/50",
          )}
        >
          <Check className="size-[18px]" strokeWidth={3.2} />
        </button>
      </div>
    </div>
  );
}

/** "Calendarinho" (dia + mês) usado nas listas de vencimentos; fica vermelho quando atrasado. */
function DateChip({ date, overdue }: { date: string; overdue: boolean }) {
  const { day, month } = dayParts(date);
  return (
    <span className={cn("flex size-11 shrink-0 flex-col items-center justify-center rounded-[14px] leading-none", overdue ? "bg-expense-soft text-expense" : "bg-brand-soft text-brand")}>
      <span className="text-[17px] font-bold tnum">{day}</span>
      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">{month}</span>
    </span>
  );
}
