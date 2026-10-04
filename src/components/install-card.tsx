"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

// Evento não padronizado (Chrome/Edge/Android): permite mostrar nosso próprio botão "Instalar".
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const standaloneQuery = () => window.matchMedia("(display-mode: standalone)");
const subscribeStandalone = (cb: () => void) => { const m = standaloneQuery(); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const isStandalone = () => standaloneQuery().matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Convida a instalar o app na tela inicial (some depois de instalado). */
export function InstallCard() {
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => true);
  const [evt, setEvt] = useState<InstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);
  const ios = useSyncExternalStore(() => () => {}, () => /iphone|ipad|ipod/i.test(navigator.userAgent), () => false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallPromptEvent); };
    const onInstalled = () => { setDone(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (standalone || done) return null;

  return (
    <section className="brand-gradient relative flex items-center gap-4 overflow-hidden rounded-[24px] p-4 text-white shadow-[var(--shadow-float)] lg:col-span-2 md:p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20"><Smartphone className="size-6" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">Instale como app</p>
        <p className="text-sm text-white/85">
          {ios ? <>Toque em <Share className="mx-0.5 inline size-3.5 align-[-2px]" /> e depois em “Adicionar à Tela de Início”.</> : evt ? "Abre em tela cheia, sem barra do navegador." : "No menu do navegador, escolha “Instalar app” ou “Adicionar à tela inicial”."}
        </p>
      </div>
      {evt && (
        <Button variant="outline" className="shrink-0 border-0 bg-white text-brand hover:bg-white/90" onClick={async () => { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === "accepted") setDone(true); setEvt(null); }}>
          Instalar
        </Button>
      )}
    </section>
  );
}
