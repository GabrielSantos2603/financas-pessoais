"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarClock, LayoutDashboard, ListChecks, Loader2, MoreHorizontal, Plus, Settings, Target, TrendingUp } from "lucide-react";
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
const initials = (s: string) => (s.split("@")[0].replace(/[^a-zA-ZÀ-ú]/g, " ").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("") || "?").toUpperCase();

function Sidebar({ household, email }: { household: Household; email: string }) {
  const path = usePathname();
  const { open } = useTxSheet();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-border bg-surface px-4 py-5 md:flex">
      <div className="flex items-center gap-3 px-2">
        <div className="brand-gradient grid size-10 place-items-center rounded-2xl text-white shadow-[var(--shadow-float)]"><TrendingUp className="size-5" /></div>
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-tight tracking-tight">Finanças</p>
          <p className="truncate text-xs text-muted">{household.name}</p>
        </div>
      </div>

      <button
        onClick={() => open()}
        className="brand-gradient mt-6 flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold text-white shadow-[var(--shadow-float)] transition hover:brightness-110 active:scale-[.98]"
      >
        <Plus className="size-5" strokeWidth={2.5} /> Novo lançamento
        <kbd className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-medium">N</kbd>
      </button>

      <nav className="mt-6 flex flex-col gap-1" aria-label="Principal">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href} href={href} aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition",
                active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {active && <span className="absolute -left-4 h-6 w-1 rounded-r-full bg-brand" />}
              <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} /> {label}
            </Link>
          );
        })}
      </nav>

      <Link href="/config" className="mt-auto flex items-center gap-3 rounded-2xl border border-border p-3 transition hover:bg-surface-2">
        <span className="brand-gradient grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white">{initials(email)}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{email.split("@")[0]}</span>
          <span className="block truncate text-xs text-muted">{email}</span>
        </span>
      </Link>
    </aside>
  );
}

function BottomNav() {
  const path = usePathname();
  const { open } = useTxSheet();
  const tab = (href: string, label: string, Icon: typeof LayoutDashboard, active = isActive(path, href)) => (
    <Link
      href={href} aria-current={active ? "page" : undefined}
      className={cn("flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-semibold transition-colors", active ? "text-brand" : "text-muted")}
    >
      <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors", active && "bg-brand-soft")}>
        <Icon className="size-[22px]" strokeWidth={active ? 2.5 : 2} />
      </span>
      {label}
    </Link>
  );
  const moreActive = ["/orcamento", "/relatorios", "/config", "/mais"].some((p) => path.startsWith(p));
  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border/70 md:hidden" aria-label="Principal">
      <div className="relative mx-auto flex max-w-lg items-end px-1">
        {tab("/", "Início", LayoutDashboard)}
        {tab("/lancamentos", "Lançamentos", ListChecks)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={() => open()} aria-label="Novo lançamento"
            className="brand-gradient -mt-7 grid size-[58px] place-items-center rounded-full text-white shadow-[var(--shadow-float)] ring-[5px] ring-bg transition active:scale-90"
          >
            <Plus className="size-7" strokeWidth={2.6} />
          </button>
        </div>
        {tab("/planejamento", "Planejar", CalendarClock)}
        {tab("/mais", "Mais", MoreHorizontal, moreActive)}
      </div>
    </nav>
  );
}

/** Puxar para atualizar (só em telas de toque, quando a página está no topo). */
function PullToRefresh() {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const onStart = (e: TouchEvent) => { start.current = window.scrollY <= 0 && !document.querySelector("dialog[open]") ? e.touches[0].clientY : null; };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy > 0 && window.scrollY <= 0) setPull(Math.min(dy * 0.5, 90)); else setPull(0);
    };
    const onEnd = async () => {
      if (start.current === null) return;
      start.current = null;
      setPull((p) => {
        if (p >= 64) { setBusy(true); void qc.invalidateQueries().finally(() => setTimeout(() => setBusy(false), 400)); }
        return 0;
      });
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => { window.removeEventListener("touchstart", onStart); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
  }, [qc]);

  const visible = pull > 8 || busy;
  return (
    <div
      aria-hidden={!visible} className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center transition-transform md:hidden"
      style={{ transform: `translateY(${busy ? 56 : Math.max(pull - 24, -48)}px)`, opacity: visible ? 1 : 0 }}
    >
      <div className="grid size-10 place-items-center rounded-full bg-surface shadow-lg ring-1 ring-border">
        <Loader2 className={cn("size-5 text-brand", (busy || fetching > 0) && pull === 0 && "animate-spin")} style={{ transform: busy ? undefined : `rotate(${pull * 4}deg)` }} />
      </div>
    </div>
  );
}

/** Atalhos do app instalado (`/?novo=1`) abrem direto o formulário. */
function LaunchShortcuts() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const { open } = useTxSheet();
  const want = params.get("novo");
  useEffect(() => {
    if (!want) return;
    open(want === "receita" ? { kind: "income" } : undefined);
    const sp = new URLSearchParams(params.toString());
    sp.delete("novo");
    router.replace(sp.size ? `${path}?${sp}` : path, { scroll: false });
  }, [want, open, params, path, router]);
  return null;
}

export function AppShell({ household, userId, email, children }: { household: Household; userId: string; email: string; children: React.ReactNode }) {
  return (
    <AppProvider value={{ household, userId, email }}>
      <TxSheetProvider>
        <Sidebar household={household} email={email} />
        <div className="md:pl-[17rem]">
          <main className="mx-auto w-full max-w-6xl px-4 pb-32 md:px-8 md:pb-12">{children}</main>
        </div>
        <BottomNav />
        <PullToRefresh />
        <LaunchShortcuts />
      </TxSheetProvider>
    </AppProvider>
  );
}
