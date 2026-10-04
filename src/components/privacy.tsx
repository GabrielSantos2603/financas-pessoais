"use client";

import { useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

/** "Ocultar valores" (olhinho): guarda a escolha e aplica a classe `privacy` no <html>; o CSS borra `.amt`. */
const KEY = "privacy";
const listeners = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

function set(hidden: boolean) {
  try { localStorage.setItem(KEY, hidden ? "1" : "0"); } catch { /* sem storage */ }
  document.documentElement.classList.toggle("privacy", hidden);
  listeners.forEach((l) => l());
}

export function usePrivacy() {
  const hidden = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    read,
    () => false,
  );
  return { hidden, toggle: () => set(!hidden) };
}

export function PrivacyToggle({ className, onDark }: { className?: string; onDark?: boolean }) {
  const { hidden, toggle } = usePrivacy();
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      onClick={toggle} aria-pressed={hidden} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} title={hidden ? "Mostrar valores" : "Ocultar valores"}
      className={cn("grid size-10 place-items-center rounded-full transition active:scale-90", onDark ? "text-white/85 hover:bg-white/15" : "text-muted hover:bg-surface-2 hover:text-fg", className)}
    >
      <Icon className="size-5" />
    </button>
  );
}
