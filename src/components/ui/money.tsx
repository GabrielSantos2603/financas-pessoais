import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { Cents } from "@/domain/money";

type Props = { cents: Cents; sign?: boolean } & Omit<React.HTMLAttributes<HTMLSpanElement>, "children">;

/**
 * Valor monetário no estilo dos apps de banco: reais em destaque e centavos menores.
 * Tem a classe `.amt`, que o modo "ocultar valores" (olhinho) borra.
 */
export function Money({ cents, sign, className, ...rest }: Props) {
  const text = money(Math.abs(cents)); // "R$ 1.234,56" — o sinal é tratado à parte
  const i = text.lastIndexOf(",");
  const prefix = cents < 0 ? "−" : sign && cents > 0 ? "+" : "";
  return (
    <span {...rest} className={cn("amt tnum whitespace-nowrap", className)} aria-label={`${prefix}${text}`}>
      {prefix}{text.slice(0, i)}<span className="text-[0.62em] font-semibold opacity-70">{text.slice(i)}</span>
    </span>
  );
}
