"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability";

// Último recurso: falha no próprio layout raiz. Não usa Tailwind/tema (podem nem ter carregado).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error, { digest: error.digest, global: true }); }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Algo deu errado</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>Recarregue a página. Seus dados estão seguros.</p>
          <button onClick={reset} style={{ marginTop: 12, height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#4f46e5", color: "#fff", fontSize: 14 }}>
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
