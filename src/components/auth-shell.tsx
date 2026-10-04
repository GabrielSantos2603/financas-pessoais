import { BarChart3, ShieldCheck, TrendingUp, Users } from "lucide-react";

const POINTS = [
  { icon: BarChart3, text: "Veja para onde vai o dinheiro, mês a mês" },
  { icon: Users, text: "Compartilhe com quem divide as contas com você" },
  { icon: ShieldCheck, text: "Seus dados protegidos, só você e sua casa acessam" },
];

/** Moldura das telas de entrada: painel de marca (desktop) / cabeçalho em gradiente (celular) + cartão do formulário. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh md:grid md:grid-cols-2">
      <section className="brand-gradient relative overflow-hidden px-6 pb-16 pt-14 text-white md:flex md:flex-col md:justify-between md:px-14 md:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/20 backdrop-blur"><TrendingUp className="size-6" /></span>
          <span className="text-xl font-bold tracking-tight">Finanças</span>
        </div>
        <div className="relative mt-10 md:mt-0">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight md:text-5xl">Seu dinheiro,<br />sob controle.</h1>
          <p className="mt-3 max-w-md text-white/85 md:text-lg">Controle financeiro pessoal e do casal. Simples no celular, completo no computador.</p>
          <ul className="mt-8 hidden space-y-4 md:block">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15"><Icon className="size-[18px]" /></span>{text}</li>
            ))}
          </ul>
        </div>
        <p className="relative hidden text-sm text-white/60 md:block">© Finanças</p>
      </section>

      <section className="relative -mt-8 rounded-t-[32px] bg-bg px-5 pb-10 pt-8 md:mt-0 md:flex md:items-center md:justify-center md:rounded-none md:px-12">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
