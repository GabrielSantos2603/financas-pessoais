"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Segmented, inputCls } from "@/components/ui/fields";
import { cn } from "@/lib/cn";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthShell
      title={mode === "signin" ? "Bem-vindo de volta" : "Crie sua conta"}
      subtitle={mode === "signin" ? "Entre para ver como está o seu mês." : "Leva menos de um minuto."}
    >
      <form onSubmit={submit} className="space-y-4">
        <Segmented value={mode} onChange={setMode} options={[{ value: "signin", label: "Entrar" }, { value: "signup", label: "Criar conta" }]} />
        <Field label="E-mail">
          {(id) => <input id={id} type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputCls, "h-12 rounded-2xl")} placeholder="voce@email.com" />}
        </Field>
        <Field label="Senha" hint={mode === "signup" ? "Mínimo de 6 caracteres." : undefined}>
          {(id) => (
            <div className="relative">
              <input id={id} type={showPassword ? "text" : "password"} required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={cn(inputCls, "h-12 rounded-2xl pr-12")} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2">
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          )}
        </Field>
        {error && <p role="alert" className="rounded-xl bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">{error}</p>}
        {info && <p role="status" className="rounded-xl bg-income-soft px-3 py-2.5 text-sm font-medium text-income">{info}</p>}
        <Button type="submit" size="lg" className="brand-gradient w-full rounded-2xl text-white shadow-[var(--shadow-float)]" loading={busy}>{mode === "signin" ? "Entrar" : "Criar conta"}</Button>
        <button type="button" onClick={magicLink} className="w-full py-1 text-center text-sm font-semibold text-brand hover:underline">
          Receber link de acesso por e-mail
        </button>
      </form>
    </AuthShell>
  );
}
