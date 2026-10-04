"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Toast = { id: number; msg: string; tone: "ok" | "error"; action?: { label: string; run: () => void } };
const Ctx = createContext<(msg: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, msg, tone: opts?.tone ?? "ok", action: opts?.action }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), opts?.action ? 6000 : 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl bg-fg px-4 py-3 text-sm text-bg shadow-lg animate-[toast-in_.2s_ease-out]"
          >
            {t.tone === "ok" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> : <XCircle className="size-4 shrink-0 text-rose-400" />}
            <span>{t.msg}</span>
            {t.action && (
              <button
                className="ml-1 font-semibold underline-offset-2 hover:underline"
                onClick={() => { t.action!.run(); setItems((l) => l.filter((x) => x.id !== t.id)); }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
