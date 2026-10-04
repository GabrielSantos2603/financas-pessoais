"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Upload } from "lucide-react";
import { parseWorkbook, type ImportResult, type SheetInput } from "@/domain/import-xlsx";
import { sumCents } from "@/domain/money";
import { useImportRows } from "@/hooks/mutations";
import { money } from "@/lib/format";
import { monthLabel } from "@/lib/dates";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const importer = useImportRows();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  async function onFile(file: File) {
    setError(""); setResult(null); setFileName(file.name);
    if (!/\.xlsx$/i.test(file.name)) return setError("Envie um arquivo .xlsx.");
    if (file.size > MAX_FILE_BYTES) return setError("Arquivo grande demais (máximo de 5 MB).");
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(file);
      const parsed = parseWorkbook(sheets as SheetInput[]);
      if (!parsed.rows.length) throw new Error("Não encontrei lançamentos. As abas precisam se chamar como JUL26, AGO26...");
      setResult(parsed);
    } catch (e) {
      setError((e as Error).message || "Não foi possível ler o arquivo.");
    }
  }

  function run() {
    if (!result) return;
    setError("");
    importer.mutate(result.rows, {
      onSuccess: ({ inserted, duplicates }) => {
        toast(`${inserted} lançamentos importados${duplicates ? ` (${duplicates} já existiam)` : ""}`);
        onClose();
      },
      onError: (e) => setError(e.message),
    });
  }

  const byMonth = result
    ? [...result.rows.reduce((m, r) => {
        const k = r.due_date.slice(0, 7);
        const cur = m.get(k) ?? { income: [] as number[], expense: [] as number[] };
        cur[r.kind].push(r.amount_cents);
        return m.set(k, cur);
      }, new Map<string, { income: number[]; expense: number[] }>())].sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <Sheet open onClose={onClose} title="Importar planilha" width="36rem"
      footer={result && <Button className="w-full" size="lg" loading={importer.isPending} onClick={run}><Upload className="size-5" /> Importar {result.rows.length} lançamentos</Button>}>
      <div className="space-y-4 pt-1">
        <p className="text-sm text-muted">
          Envie o arquivo <b>.xlsx</b> no formato da sua planilha (uma aba por mês: JUL26, AGO26...). Receitas ficam à esquerda e despesas à direita. A leitura acontece no seu navegador.
        </p>
        <input ref={input} type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-6 text-center transition hover:border-brand hover:bg-brand-soft/40">
          <FileSpreadsheet className="size-8 text-brand" />
          <span className="font-medium">{fileName || "Escolher arquivo .xlsx"}</span>
        </button>
        {error && <p role="alert" className="rounded-lg bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p>}
        {result && (
          <>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="tnum w-full text-sm">
                <thead className="bg-surface-2 text-xs text-muted"><tr><th className="px-3 py-2 text-left font-medium">Mês</th><th className="px-2 text-right font-medium">Receitas</th><th className="px-3 text-right font-medium">Despesas</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {byMonth.map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-3 py-2">{monthLabel(k)} <span className="text-xs text-muted">({v.income.length + v.expense.length})</span></td>
                      <td className="px-2 text-right text-income">{money(sumCents(v.income))}</td>
                      <td className="px-3 text-right">{money(sumCents(v.expense))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.skipped.length > 0 && (
              <details className="rounded-xl bg-warn-soft p-3 text-sm text-warn">
                <summary className="flex cursor-pointer items-center gap-2 font-medium"><AlertTriangle className="size-4" /> {result.skipped.length} linhas ignoradas (sem valor ou descrição)</summary>
                <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                  {result.skipped.map((s, i) => <li key={i}>{s.sheet}: {s.text} — {s.reason}</li>)}
                </ul>
              </details>
            )}
            <p className="text-xs text-muted">Categorias são sugeridas pelo nome (ex.: “Supermercado” → Mercado) e podem ser ajustadas depois. Lançamentos idênticos já existentes não são duplicados. A importação é atômica: se algo falhar, nada é gravado.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
