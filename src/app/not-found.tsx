import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold text-brand">404</p>
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="text-sm text-muted">O endereço não existe ou foi movido.</p>
      <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-medium text-brand-fg">Voltar ao início</Link>
    </main>
  );
}
