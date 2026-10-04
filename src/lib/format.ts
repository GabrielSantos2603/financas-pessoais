import type { Cents } from "@/domain/money";

// Formatação para EXIBIÇÃO. Todos os valores de entrada estão em centavos.
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const brlInput = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (cents: Cents) => brl.format(cents / 100);
export const moneyCompact = (cents: Cents) => `R$ ${brlCompact.format(cents / 100)}`;
export const pct = (v: number) => `${Math.round(v)}%`;
/** 123456 → "1.234,56" (campos de entrada) */
export const formatCentsInput = (cents: Cents) => brlInput.format(cents / 100);
