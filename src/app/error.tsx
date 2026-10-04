"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { reportError } from "@/lib/observability";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error, { digest: error.digest }); }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-expense-soft text-expense"><TriangleAlert className="size-7" /></div>
      <h1 className="text-xl font-bold">Algo deu errado</h1>
      <p className="text-sm text-muted">Não foi possível carregar esta tela. Seus dados estão seguros. Tente novamente.</p>
      <button onClick={reset} className="h-11 rounded-xl bg-brand px-5 text-sm font-medium text-brand-fg">Tentar de novo</button>
    </main>
  );
}
