import Link from "next/link";
import { BarChart3, ChevronRight, Settings, Target } from "lucide-react";

const ITEMS = [
  { href: "/orcamento", label: "Orçamento", hint: "Limites por categoria", icon: Target },
  { href: "/relatorios", label: "Relatórios", hint: "Evolução, categorias e pessoas", icon: BarChart3 },
  { href: "/config", label: "Configurações", hint: "Categorias, contas, convite, importar planilha", icon: Settings },
];

export default function MaisPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mais</h1>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {ITEMS.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 px-4 py-4 transition hover:bg-surface-2/60">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span>
              <span className="flex-1"><span className="block font-semibold">{label}</span><span className="block text-sm text-muted">{hint}</span></span>
              <ChevronRight className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
