"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarClock, LayoutDashboard, ListChecks, MoreHorizontal, Plus, Settings, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Household } from "@/types/db";
import { AppProvider } from "@/components/app-context";
import { TxSheetProvider, useTxSheet } from "@/components/finance/tx-sheet";

const NAV = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: ListChecks },
  { href: "/planejamento", label: "Planejamento", icon: CalendarClock },
  { href: "/orcamento", label: "Orçamento", icon: Target },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/config", label: "Configurações", icon: Settings },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function Sidebar({ household }: { household: Household }) {
  const path = usePathname();
  const { open } = useTxSheet();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface p-4 md:flex">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <div className="grid size-9 place-items-center rounded-xl bg-brand text-brand-fg"><TrendingUp className="size-5" /></div>
        <div className="min-w-0">
          <p className="font-bold leading-tight">Finanças</p>
          <p className="truncate text-xs text-muted">{household.name}</p>
        </div>
      </div>
      <button
        onClick={() => open()}
        className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand font-medium text-brand-fg shadow-sm transition hover:opacity-90 active:scale-[.98]"
      >
        <Plus className="size-5" /> Novo lançamento
      </button>
      <nav className="mt-5 flex flex-col gap-1" aria-label="Principal">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
              isActive(path, href) ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-5" /> {label}
          </Link>
        ))}
      </nav>
      <p className="mt-auto px-2 text-xs text-muted">Atalho: <kbd className="rounded border border-border px-1">N</kbd> novo lançamento</p>
    </aside>
  );
}

function BottomNav() {
  const path = usePathname();
  const { open } = useTxSheet();
  const item = (href: string, label: string, Icon: typeof LayoutDashboard, match = href) => (
    <Link
      href={href} aria-current={isActive(path, match) ? "page" : undefined}
      className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive(path, match) ? "text-brand" : "text-muted")}
    >
      <Icon className="size-6" /> {label}
    </Link>
  );
  const moreActive = ["/orcamento", "/relatorios", "/config", "/mais"].some((p) => path.startsWith(p));
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden" aria-label="Principal">
      <div className="relative mx-auto flex max-w-lg items-end px-2">
        {item("/", "Início", LayoutDashboard)}
        {item("/lancamentos", "Lançamentos", ListChecks)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={() => open()} aria-label="Novo lançamento"
            className="-mt-6 grid size-14 place-items-center rounded-full bg-brand text-brand-fg shadow-lg shadow-brand/30 ring-4 ring-bg transition active:scale-95"
          >
            <Plus className="size-7" />
          </button>
        </div>
        {item("/planejamento", "Planejar", CalendarClock)}
        <Link
          href="/mais" aria-current={moreActive ? "page" : undefined}
          className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium", moreActive ? "text-brand" : "text-muted")}
        >
          <MoreHorizontal className="size-6" /> Mais
        </Link>
      </div>
    </nav>
  );
}

export function AppShell({ household, userId, email, children }: { household: Household; userId: string; email: string; children: React.ReactNode }) {
  return (
    <AppProvider value={{ household, userId, email }}>
      <TxSheetProvider>
        <Sidebar household={household} />
        <div className="md:pl-64">
          <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">{children}</main>
        </div>
        <BottomNav />
      </TxSheetProvider>
    </AppProvider>
  );
}
