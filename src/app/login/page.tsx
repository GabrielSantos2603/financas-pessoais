"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Segmented, inputCls } from "@/components/ui/fields";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setInfo("");
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message); setBusy(false); return; }
      router.replace("/"); router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) { setError(error.message); setBusy(false); return; }
      if (data.session) { router.replace("/"); router.refresh(); }
      else { setInfo("Enviamos um link de confirmação para o seu e-mail."); setBusy(false); }
    }
  }

  async function magicLink() {
    if (!email) return setError("Digite seu e-mail primeiro.");
    setBusy(true); setError(""); setInfo("");
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setBusy(false);
    if (error) setError(error.message); else setInfo("Link de acesso enviado! Confira seu e-mail.");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-brand text-brand-fg shadow-lg shadow-brand/30"><TrendingUp className="size-8" /></div>
        <h1 className="text-2xl font-bold">Finanças</h1>
        <p className="text-sm text-muted">Seu dinheiro organizado, no celular e no computador.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <Segmented value={mode} onChange={setMode} options={[{ value: "signin", label: "Entrar" }, { value: "signup", label: "Criar conta" }]} />
        <Field label="E-mail">
          {(id) => <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="voce@email.com" />}
        </Field>
        <Field label="Senha" hint={mode === "signup" ? "Mínimo de 6 caracteres." : undefined}>
          {(id) => <input id={id} type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />}
        </Field>
        {error && <p role="alert" className="rounded-lg bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p>}
        {info && <p role="status" className="rounded-lg bg-income-soft px-3 py-2 text-sm text-income">{info}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === "signin" ? "Entrar" : "Criar conta"}</Button>
        <button type="button" onClick={magicLink} className="w-full text-center text-sm font-medium text-brand hover:underline">
          Receber link de acesso por e-mail
        </button>
      </form>
    </main>
  );
}
