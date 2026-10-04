"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Users } from "lucide-react";
import { getDb } from "@/hooks/db";
import { createHousehold, joinHousehold } from "@/services/household";
import { Button } from "@/components/ui/button";
import { Field, Segmented, inputCls } from "@/components/ui/fields";

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Bem-vindo! 👋</h1>
        <p className="mt-1 text-sm text-muted">Vamos preparar o seu espaço. Leva menos de um minuto.</p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <Segmented value={mode} onChange={setMode} options={[{ value: "create", label: "Começar do zero" }, { value: "join", label: "Tenho um convite" }]} />
        {mode === "create" ? (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-brand-soft p-3 text-sm text-brand">
              <Home className="mt-0.5 size-4 shrink-0" />
              Criamos categorias, contas e a sua pessoa. Depois você convida quem divide as finanças com você.
            </div>
            <Field label="Seu nome">{(id) => <input id={id} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ex.: Gabriel" />}</Field>
            <Field label="Nome do espaço" hint="Pode ser “Casa”, “Família”, “Gabriel & Emanuelle”...">
              {(id) => <input id={id} maxLength={80} value={house} onChange={(e) => setHouse(e.target.value)} className={inputCls} placeholder="Minha casa" />}
            </Field>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-brand-soft p-3 text-sm text-brand">
              <Users className="mt-0.5 size-4 shrink-0" />
              Peça o código em Configurações → Compartilhar de quem já usa o app.
            </div>
            <Field label="Código de convite">
              {(id) => <input id={id} required value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="Cole o código aqui" autoCapitalize="none" autoComplete="off" spellCheck={false} />}
            </Field>
          </>
        )}
        {error && <p role="alert" className="rounded-lg bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === "create" ? "Criar meu espaço" : "Entrar no espaço"}</Button>
      </form>
    </main>
  );
}
