"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, FileSpreadsheet, Moon, Settings, Target, Users } from "lucide-react";
import { useApp } from "@/components/app-context";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

const initials = (s: string) => (s.split("@")[0].replace(/[^a-zA-ZÀ-ú]/g, " ").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("") || "?").toUpperCase();

const ITEMS = [
  { href: "/orcamento", label: "Orçamento", hint: "Limites por categoria", icon: Target, color: "#5b3df5" },
  { href: "/relatorios", label: "Relatórios", hint: "Evolução, categorias e pessoas", icon: BarChart3, color: "#0e9f6e" },
  { href: "/config", label: "Compartilhar", hint: "Convide quem divide as contas com você", icon: Users, color: "#ec4899" },
  { href: "/config", label: "Importar planilha", hint: "Traga seus meses do Excel", icon: FileSpreadsheet, color: "#d98200" },
  { href: "/config", label: "Aparência e configurações", hint: "Tema, categorias, contas e pessoas", icon: Settings, color: "#64748b" },
];

export default function MaisPage() {
  const { email, household } = useApp();
  return (
    <div className="pb-4">
      <PageHeader title="Mais" />
      <div className="mt-4 space-y-5">
        <Link href="/config" className="brand-gradient flex items-center gap-4 rounded-[24px] p-4 text-white shadow-[var(--shadow-float)]">
          <span className="grid size-14 place-items-center rounded-full bg-white/20 text-lg font-bold">{initials(email)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold">{email.split("@")[0]}</span>
            <span className="block truncate text-sm text-white/80">{household.name} · {email}</span>
          </span>
          <ChevronRight className="size-5 text-white/80" />
        </Link>

        <Card className="divide-y divide-border/70 overflow-hidden">
          {ITEMS.map(({ href, label, hint, icon: Icon, color }) => (
            <Link key={label} href={href} className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-surface-2/50 active:bg-surface-2">
              <span className="grid size-11 place-items-center rounded-[14px]" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{label}</span><span className="block truncate text-xs text-muted">{hint}</span></span>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ))}
        </Card>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><Moon className="size-3.5" /> Dica: ative o tema escuro em Configurações → Aparência.</p>
      </div>
    </div>
  );
}
