"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Users } from "lucide-react";
import { getDb } from "@/hooks/db";
import { createHousehold, joinHousehold } from "@/services/household";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Segmented, inputCls } from "@/components/ui/fields";
import { cn } from "@/lib/cn";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [house, setHouse] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (mode === "create") await createHousehold(getDb(), house || "Minha casa", name);
      else await joinHousehold(getDb(), code);
      router.replace("/"); router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Vamos preparar seu espaço" subtitle="Leva menos de um minuto.">
      <form onSubmit={submit} className="space-y-4">
        <Segmented value={mode} onChange={setMode} options={[{ value: "create", label: "Começar do zero" }, { value: "join", label: "Tenho um convite" }]} />
        {mode === "create" ? (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-brand-soft p-3.5 text-sm text-brand">
              <Home className="mt-0.5 size-4 shrink-0" />
              Criamos categorias, contas e a sua pessoa. Depois você convida quem divide as finanças com você.
            </div>
            <Field label="Seu nome">{(id) => <input id={id} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={cn(inputCls, "h-12 rounded-2xl")} placeholder="Ex.: Gabriel" />}</Field>
            <Field label="Nome do espaço" hint="Pode ser “Casa”, “Família”, “Gabriel & Emanuelle”...">
              {(id) => <input id={id} maxLength={80} value={house} onChange={(e) => setHouse(e.target.value)} className={cn(inputCls, "h-12 rounded-2xl")} placeholder="Minha casa" />}
            </Field>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-brand-soft p-3.5 text-sm text-brand">
              <Users className="mt-0.5 size-4 shrink-0" />
              Peça o código em Configurações → Compartilhar de quem já usa o app.
            </div>
            <Field label="Código de convite">
              {(id) => <input id={id} required value={code} onChange={(e) => setCode(e.target.value)} className={cn(inputCls, "h-12 rounded-2xl")} placeholder="Cole o código aqui" autoCapitalize="none" autoComplete="off" spellCheck={false} />}
            </Field>
          </>
        )}
        {error && <p role="alert" className="rounded-xl bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">{error}</p>}
        <Button type="submit" size="lg" className="brand-gradient w-full rounded-2xl text-white shadow-[var(--shadow-float)]" loading={busy}>{mode === "create" ? "Criar meu espaço" : "Entrar no espaço"}</Button>
      </form>
    </AuthShell>
  );
}
