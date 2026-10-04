"use client";

import { MonthSwitcher } from "@/components/finance/month-switcher";
import { PrivacyToggle } from "@/components/privacy";

/**
 * Cabeçalho de página.
 * Celular: barra fixa com vidro (mês + olhinho) e, abaixo, um "título grande" que rola junto com a página
 *          — o mesmo padrão dos apps nativos. Sem seletor de mês, o título vai na própria barra.
 * Desktop: título grande à esquerda e mês/ações à direita.
 */
export function PageHeader({ title, subtitle, month, actions }: {
  title: string; subtitle?: string; month?: { value: string; onChange: (m: string) => void }; actions?: React.ReactNode;
}) {
  return (
    <>
      <header className="glass safe-top sticky top-0 z-20 -mx-4 border-b border-border/60 px-4 md:hidden">
        <div className="flex h-14 items-center gap-2">
          {month ? <MonthSwitcher month={month.value} onChange={month.onChange} className="min-w-0" /> : <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight">{title}</h1>}
          {month && <div className="flex-1" />}
          <PrivacyToggle />
          {actions}
        </div>
      </header>
      {month && <h1 className="pt-4 text-[26px] font-bold leading-tight tracking-tight md:hidden">{title}</h1>}

      <header className="hidden items-center gap-3 pb-6 pt-8 md:flex">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {month && <MonthSwitcher month={month.value} onChange={month.onChange} />}
        <PrivacyToggle />
        {actions}
      </header>
    </>
  );
}
