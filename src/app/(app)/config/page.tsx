"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Copy, FileSpreadsheet, LogOut, Monitor, Moon, Plus, RefreshCw, Sun, Trash2, UserMinus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-context";
import { useMembers, useRefs } from "@/hooks/queries";
import { useEntityMutations, useHouseholdMutations } from "@/hooks/mutations";
import { ImportSheet } from "@/components/finance/import-sheet";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Segmented, Switch, inputCls } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { CategoryIcon, ICON_NAMES } from "@/lib/icons";
import { cn } from "@/lib/cn";
import type { Account, AccountKind, Category, Kind, Person } from "@/types/db";

const COLORS = ["#6366f1", "#0ea5e9", "#14b8a6", "#10b981", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#64748b"];
const ACCOUNT_KINDS: Record<AccountKind, string> = { checking: "Conta corrente", card: "Cartão de crédito", cash: "Dinheiro", savings: "Poupança", investment: "Investimento" };

type Editing =
  | { type: "person"; item: Partial<Person> }
  | { type: "account"; item: Partial<Account> }
  | { type: "category"; item: Partial<Category> }
  | null;

export default function ConfigPage() {
  const refs = useRefs();
  const { email } = useApp();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [importing, setImporting] = useState(false);
  const [catKind, setCatKind] = useState<Kind>("expense");

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login"); router.refresh();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <header><h1 className="text-xl font-bold md:text-2xl">Configurações</h1><p className="text-sm text-muted">{email}</p></header>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pessoas" action={<Button size="sm" variant="soft" onClick={() => setEditing({ type: "person", item: { color: COLORS[refs.people.length % COLORS.length] } })}><Plus className="size-4" /> Nova</Button>} />
          <p className="px-4 pt-1 text-xs text-muted md:px-5">Quem aparece no campo “Nome” da planilha. Não precisa ter login.</p>
          <ul className="mt-2 divide-y divide-border pb-1">
            {refs.people.map((p) => (
              <li key={p.id}><Row onClick={() => setEditing({ type: "person", item: p })} lead={<span className="size-4 rounded-full" style={{ background: p.color }} />} title={p.name} muted={p.archived ? "Arquivada" : undefined} /></li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Contas e cartões" action={<Button size="sm" variant="soft" onClick={() => setEditing({ type: "account", item: { kind: "checking", color: COLORS[1] } })}><Plus className="size-4" /> Nova</Button>} />
          <ul className="mt-2 divide-y divide-border pb-1">
            {refs.accounts.map((a) => (
              <li key={a.id}><Row onClick={() => setEditing({ type: "account", item: a })} lead={<span className="size-4 rounded-full" style={{ background: a.color }} />} title={a.name} muted={ACCOUNT_KINDS[a.kind] + (a.archived ? " · arquivada" : "")} /></li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Categorias" action={<Button size="sm" variant="soft" onClick={() => setEditing({ type: "category", item: { kind: catKind, icon: "tag", color: COLORS[0], is_savings: false } })}><Plus className="size-4" /> Nova</Button>} />
          <div className="px-4 pt-3 md:px-5"><Segmented className="md:w-72" value={catKind} onChange={setCatKind} options={[{ value: "expense", label: "Despesas", tone: "expense" }, { value: "income", label: "Receitas", tone: "income" }]} /></div>
          <ul className="mt-2 grid gap-x-6 pb-2 md:grid-cols-2">
            {refs.categories.filter((c) => c.kind === catKind).map((c) => (
              <li key={c.id} className="border-b border-border last:border-0">
                <Row onClick={() => setEditing({ type: "category", item: c })}
                  lead={<span className="grid size-8 place-items-center rounded-full text-white" style={{ background: c.color }}><CategoryIcon name={c.icon} className="size-4" /></span>}
                  title={c.name} muted={[c.is_savings && "Conta como guardado", c.archived && "arquivada"].filter(Boolean).join(" · ") || undefined} />
              </li>
            ))}
          </ul>
        </Card>

        <SharingCard />

        <Card>
          <CardHeader title="Aparência" />
          <div className="p-4 md:p-5"><ThemeSwitch /></div>
        </Card>

        <Card className="lg:col-span-2">
          <button onClick={() => setImporting(true)} className="flex w-full items-center gap-3 p-4 text-left md:p-5">
            <span className="grid size-11 place-items-center rounded-xl bg-income-soft text-income"><FileSpreadsheet className="size-6" /></span>
            <span className="flex-1"><span className="block font-semibold">Importar planilha do Excel</span><span className="block text-sm text-muted">Traga seus meses anteriores (JUL26, AGO26...) de uma vez.</span></span>
            <ChevronRight className="size-5 text-muted" />
          </button>
        </Card>
      </div>

      <Button variant="outline" size="lg" className="w-full text-expense md:w-auto" onClick={signOut}><LogOut className="size-5" /> Sair da conta</Button>

      {editing && <EntitySheet editing={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </div>
  );
}

/* ---------------- Compartilhar ---------------- */
function SharingCard() {
  const { household, userId } = useApp();
  const router = useRouter();
  const toast = useToast();
  const members = useMembers();
  const { rotate, removeMember, leave } = useHouseholdMutations();
  const [code, setCode] = useState(household.invite_code);
  const [confirm, setConfirm] = useState<"rotate" | "leave" | { remove: string } | null>(null);

  const list = members.data ?? [];
  const me = list.find((m) => m.user_id === userId);
  const isOwner = me?.role === "owner";
  const fail = (e: Error) => toast(e.message, { tone: "error" });

  async function copyCode() {
    try { await navigator.clipboard.writeText(code); toast("Código copiado!"); } catch { toast(code); }
  }
  function doRotate() {
    rotate.mutate(undefined, { onSuccess: (c) => { setCode(c); setConfirm(null); toast("Novo código gerado. O anterior não funciona mais."); router.refresh(); }, onError: fail });
  }
  function doLeave() {
    leave.mutate(undefined, { onSuccess: () => { router.replace("/onboarding"); router.refresh(); }, onError: (e) => { fail(e); setConfirm(null); } });
  }
  function doRemove(userIdToRemove: string) {
    removeMember.mutate(userIdToRemove, { onSuccess: () => { setConfirm(null); toast("Membro removido"); }, onError: (e) => { fail(e); setConfirm(null); } });
  }

  return (
    <Card>
      <CardHeader title="Compartilhar" />
      <div className="space-y-3 p-4 md:p-5">
        <p className="flex items-start gap-2 text-sm text-muted"><Users className="mt-0.5 size-4 shrink-0" />Quem entrar com o código abaixo enxerga e edita os mesmos lançamentos (ideal para casal).</p>
        <div className="flex items-center gap-2">
          <code className="tnum min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3 py-3 text-center text-sm font-bold tracking-wider">{code}</code>
          <Button variant="outline" size="icon" aria-label="Copiar código" onClick={copyCode}><Copy className="size-5" /></Button>
          {isOwner && <Button variant="outline" size="icon" aria-label="Gerar novo código" onClick={() => setConfirm("rotate")}><RefreshCw className="size-5" /></Button>}
        </div>
        {confirm === "rotate" && (
          <Confirm text="Gerar um novo código? O código atual deixa de funcionar." busy={rotate.isPending} onNo={() => setConfirm(null)} onYes={doRotate} />
        )}

        <ul className="divide-y divide-border rounded-xl border border-border">
          {list.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{m.email ?? "Sem e-mail"}{m.user_id === userId && <span className="text-muted"> (você)</span>}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{m.role === "owner" ? "Dono" : "Membro"}</span>
              {isOwner && m.user_id !== userId && (
                <button aria-label={`Remover ${m.email ?? "membro"}`} onClick={() => setConfirm({ remove: m.user_id })} className="grid size-8 place-items-center rounded-full text-expense hover:bg-expense-soft"><UserMinus className="size-4" /></button>
              )}
            </li>
          ))}
        </ul>
        {typeof confirm === "object" && confirm && (
          <Confirm text="Remover este membro do espaço?" busy={removeMember.isPending} onNo={() => setConfirm(null)} onYes={() => doRemove(confirm.remove)} />
        )}

        <button onClick={() => setConfirm("leave")} className="text-sm font-medium text-expense hover:underline">Sair deste espaço</button>
        {confirm === "leave" && (
          <Confirm
            text={isOwner && list.length === 1 ? "Você é o único membro: sair APAGA o espaço e todos os lançamentos. Continuar?" : "Sair deste espaço? Você perde o acesso aos dados."}
            busy={leave.isPending} onNo={() => setConfirm(null)} onYes={doLeave}
          />
        )}
      </div>
    </Card>
  );
}

function Confirm({ text, busy, onNo, onYes }: { text: string; busy: boolean; onNo: () => void; onYes: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-expense-soft p-3 text-sm text-expense">
      <p className="min-w-40 flex-1 font-medium">{text}</p>
      <Button size="sm" variant="outline" onClick={onNo}>Não</Button>
      <Button size="sm" variant="danger" loading={busy} onClick={onYes}>Sim</Button>
    </div>
  );
}

function Row({ lead, title, muted, onClick }: { lead: React.ReactNode; title: string; muted?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2/60 md:px-5">
      {lead}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span>{muted && <span className="block text-xs text-muted">{muted}</span>}</span>
      <ChevronRight className="size-4 text-muted" />
    </button>
  );
}

type Theme = "system" | "light" | "dark";
const themeListeners = new Set<() => void>();
const readTheme = (): Theme => { try { return (localStorage.getItem("theme") as Theme) || "system"; } catch { return "system"; } };

function ThemeSwitch() {
  const t = useSyncExternalStore(
    (cb) => { themeListeners.add(cb); return () => { themeListeners.delete(cb); }; },
    readTheme,
    () => "system" as Theme,
  );
  function apply(v: Theme) {
    try { localStorage.setItem("theme", v); } catch { /* sem storage */ }
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    themeListeners.forEach((l) => l());
  }
  const opts = [{ v: "system", l: "Sistema", i: Monitor }, { v: "light", l: "Claro", i: Sun }, { v: "dark", l: "Escuro", i: Moon }] as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map(({ v, l, i: Icon }) => (
        <button key={v} onClick={() => apply(v)} aria-pressed={t === v}
          className={cn("flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium transition", t === v ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-fg")}>
          <Icon className="size-5" />{l}
        </button>
      ))}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
      {COLORS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)}
          className="grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-surface transition" style={{ background: c, boxShadow: value === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }}>
          {value === c && <Check className="size-4 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

function EntitySheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const toast = useToast();
  const m = useEntityMutations();
  const it = editing.item as { id?: string; name?: string; color?: string; archived?: boolean; kind?: string; icon?: string; is_savings?: boolean };
  const [name, setName] = useState(it.name ?? "");
  const [color, setColor] = useState(it.color ?? COLORS[0]);
  const [kind, setKind] = useState<string>(it.kind ?? (editing.type === "account" ? "checking" : "expense"));
  const [icon, setIcon] = useState(it.icon ?? "tag");
  const [savings, setSavings] = useState(it.is_savings ?? false);
  const [archived, setArchived] = useState(it.archived ?? false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const label = { person: "pessoa", account: "conta", category: "categoria" }[editing.type];
  const busy = m.savePerson.isPending || m.saveAccount.isPending || m.saveCategory.isPending || m.remove.isPending;
  const callbacks = (msg: string) => ({ onSuccess: () => { toast(msg); onClose(); }, onError: (e: Error) => { setError(e.message); setConfirm(false); } });

  function save() {
    if (!name.trim()) return setError("Informe um nome.");
    setError("");
    const base = { id: it.id, name: name.trim(), color, archived };
    if (editing.type === "person") m.savePerson.mutate(base, callbacks("Salvo"));
    else if (editing.type === "account") m.saveAccount.mutate({ ...base, kind: kind as AccountKind }, callbacks("Salvo"));
    else m.saveCategory.mutate({ ...base, kind: kind as Kind, icon, is_savings: kind === "expense" && savings }, callbacks("Salvo"));
  }
  const table = editing.type === "person" ? "people" : editing.type === "account" ? "accounts" : "categories";

  return (
    <Sheet open onClose={onClose} title={`${it.id ? "Editar" : "Nova"} ${label}`}
      footer={
        <div className="space-y-2">
          {error && <p role="alert" className="rounded-lg bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p>}
          {confirm ? (
            <div className="flex items-center gap-2"><p className="flex-1 text-sm font-medium">Lançamentos ligados ficarão sem {label}. Remover?</p>
              <Button variant="outline" size="sm" onClick={() => setConfirm(false)}>Não</Button>
              <Button variant="danger" size="sm" loading={m.remove.isPending} onClick={() => m.remove.mutate({ table, id: it.id! }, callbacks("Removido"))}>Remover</Button></div>
          ) : (
            <div className="flex gap-2">
              {it.id && <Button variant="outline" size="icon" className="size-11 text-expense" aria-label="Remover" onClick={() => setConfirm(true)}><Trash2 className="size-5" /></Button>}
              <Button className="flex-1" size="lg" loading={busy} onClick={save}>Salvar</Button>
            </div>
          )}
        </div>
      }>
      <div className="space-y-4 pt-1">
        <Field label="Nome">{(id) => <input id={id} autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputCls} />}</Field>
        {editing.type === "account" && (
          <Field label="Tipo">{(id) => <select id={id} value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>{Object.entries(ACCOUNT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}</Field>
        )}
        {editing.type === "category" && (
          <>
            {!it.id && <Segmented value={kind as Kind} onChange={setKind} options={[{ value: "expense", label: "Despesa", tone: "expense" }, { value: "income", label: "Receita", tone: "income" }]} />}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">Ícone</p>
              <div className="flex flex-wrap gap-2">
                {ICON_NAMES.map((n) => (
                  <button key={n} type="button" onClick={() => setIcon(n)} aria-pressed={icon === n} aria-label={n}
                    className={cn("grid size-10 place-items-center rounded-xl border transition", icon === n ? "border-brand bg-brand-soft text-brand" : "border-border text-muted")}>
                    <CategoryIcon name={n} className="size-5" />
                  </button>
                ))}
              </div>
            </div>
            {kind === "expense" && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
                <span><span className="block text-sm font-medium">Conta como “guardado”</span><span className="block text-xs text-muted">Sai do caixa, mas não é gasto (reserva, investimento).</span></span>
                <Switch checked={savings} onChange={setSavings} label="Conta como guardado" />
              </div>
            )}
          </>
        )}
        <div className="space-y-1.5"><p className="text-xs font-medium text-muted">Cor</p><ColorPicker value={color} onChange={setColor} /></div>
        {it.id && (
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
            <span className="text-sm font-medium">Arquivada (esconder das listas)</span><Switch checked={archived} onChange={setArchived} label="Arquivada" />
          </div>
        )}
      </div>
    </Sheet>
  );
}
