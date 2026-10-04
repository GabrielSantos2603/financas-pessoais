"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { reportError } from "@/lib/observability";
import { friendlyMessage } from "@/services/db";

/** Avisa o usuário (com toast) quando uma consulta falha, sem repetir a mesma mensagem em sequência. */
function QueryErrorBridge() {
  const client = useQueryClient();
  const toast = useToast();
  useEffect(() => {
    let last = { msg: "", at: 0 };
    return client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      const error = event.action.error as { message: string; code?: string };
      reportError(error, { queryKey: event.query.queryKey });
      const msg = friendlyMessage(error);
      if (msg === last.msg && Date.now() - last.at < 8000) return;
      last = { msg, at: Date.now() };
      toast(msg, { tone: "error" });
    });
  }, [client, toast]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <QueryErrorBridge />
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
