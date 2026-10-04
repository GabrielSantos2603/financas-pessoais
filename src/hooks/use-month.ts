"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentMonthKey } from "@/lib/dates";

/** Mês selecionado, guardado na URL (?m=2026-10) para poder compartilhar/voltar. */
export function useMonth() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const raw = params.get("m");
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonthKey();

  const setMonth = useCallback(
    (m: string) => {
      const sp = new URLSearchParams(params.toString());
      if (m === currentMonthKey()) sp.delete("m"); else sp.set("m", m);
      const qs = sp.toString();
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    },
    [params, path, router],
  );
  return { month, setMonth };
}
