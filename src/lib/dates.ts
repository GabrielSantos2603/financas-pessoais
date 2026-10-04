import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const iso = (d: Date) => format(d, "yyyy-MM-dd");
export const today = () => iso(new Date());

/** "2026-10" ou "2026-10-15" → Date no dia 1 do mês (local) */
export const monthStart = (key: string) => startOfMonth(parseISO(key.length === 7 ? key + "-01" : key));
export const monthKey = (d: Date) => format(d, "yyyy-MM");
export const currentMonthKey = () => monthKey(new Date());
export const shiftMonth = (key: string, n: number) => monthKey(addMonths(monthStart(key), n));
export const monthRange = (key: string) => {
  const s = monthStart(key);
  return { from: iso(s), to: iso(endOfMonth(s)) };
};
export const monthLabel = (key: string) => {
  const s = format(monthStart(key), "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const monthShort = (key: string) => format(monthStart(key), "MMM", { locale: ptBR }).replace(".", "");
export const monthFirstDay = (key: string) => iso(monthStart(key));

export const dayLabel = (isoDate: string) => {
  const d = parseISO(isoDate);
  const t = today();
  if (isoDate === t) return "Hoje";
  const diff = Math.round((d.getTime() - parseISO(t).getTime()) / 86400000);
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return format(d, "EEEE, d 'de' MMM", { locale: ptBR });
};
export const shortDate = (isoDate: string) => format(parseISO(isoDate), "dd/MM");
export const addMonthsToDate = (isoDate: string, n: number) => {
  // preserva o dia, limitando ao último dia do mês (31/01 + 1 mês = 28/02)
  const d = parseISO(isoDate);
  return iso(addMonths(d, n));
};
export const daysUntil = (isoDate: string) =>
  Math.round((parseISO(isoDate).getTime() - parseISO(today()).getTime()) / 86400000);
