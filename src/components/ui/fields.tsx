"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { formatCentsInput } from "@/lib/format";
import { parseCents, type Cents } from "@/domain/money";

export const inputCls =
  "h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Campo de dinheiro em CENTAVOS (value/onChange trabalham com inteiros). */
export function MoneyInput({ value, onChange, large, hero, id, autoFocus }: {
  value: Cents; onChange: (v: Cents) => void; large?: boolean; id?: string; autoFocus?: boolean;
  /** valor gigante, sem caixa, para usar sobre um fundo colorido (cabeçalho do lançamento) */
  hero?: boolean;
}) {
  if (hero) {
    return (
      <div className="flex items-baseline gap-2 text-white">
        <span className="text-2xl font-semibold opacity-80">R$</span>
        <input
          id={id} autoFocus={autoFocus} inputMode="numeric" aria-label="Valor"
          value={formatCentsInput(value)} onChange={(e) => onChange(parseCents(e.target.value))} onFocus={(e) => e.currentTarget.select()}
          className="tnum w-full min-w-0 border-0 bg-transparent p-0 text-[44px] font-bold leading-tight tracking-tight text-white outline-none placeholder:text-white/50 md:text-5xl"
        />
      </div>
    );
  }
  return (
    <div className="relative">
      <span className={cn("pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-muted", large ? "text-xl" : "text-sm")}>R$</span>
      <input
        id={id}
        autoFocus={autoFocus}
        inputMode="numeric"
        value={formatCentsInput(value)}
        onChange={(e) => onChange(parseCents(e.target.value))}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(inputCls, "tnum text-right", large ? "h-16 pl-12 text-3xl font-bold" : "pl-10")}
      />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; tone?: "income" | "expense" }[]; className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        const tone = o.tone === "income" ? "text-income" : o.tone === "expense" ? "text-expense" : "text-fg";
        return (
          <button
            key={o.value} role="tab" aria-selected={active} type="button" onClick={() => onChange(o.value)}
            className={cn("h-9 flex-1 rounded-lg px-3 text-sm font-medium transition", active ? cn("bg-surface shadow-sm", tone) : "text-muted hover:text-fg")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition",
        active ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-muted hover:text-fg",
      )}
    >
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-border")}
    >
      <span className={cn("absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}
