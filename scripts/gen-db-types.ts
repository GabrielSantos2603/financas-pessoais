/**
 * Gera src/types/database.ts a partir do schema REAL (aplica as migrations num Postgres embutido).
 * Não precisa de Docker nem de conexão com o Supabase.
 *
 *   npm run db:types           → reescreve o arquivo
 *   npm run db:types -- --check → falha (exit 1) se o arquivo estiver desatualizado (usado no CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDb } from "../tests/db/harness";

const OUT = join(process.cwd(), "src", "types", "database.ts");

// Funções internas que não fazem parte da API do app.
const HIDDEN_FUNCTIONS = new Set(["require_household", "current_household", "is_member"]);

// O Postgres não informa quais argumentos aceitam NULL; por convenção do projeto aceitam:
// referências opcionais (p_person_id, p_category_id, p_account_id), p_notes e p_today.
// (p_id, p_user e demais ficam obrigatórios.)
const NULLABLE_ARG = /^p_(?!id$).+_id$|^p_notes$|^p_today$/;

// Colunas de retorno que podem vir NULL (lançamento sem categoria/pessoa).
const NULLABLE_COLUMN = /^(category_id|person_id)$/;

const SCALAR: Record<string, string> = {
  uuid: "string", text: "string", varchar: "string", bpchar: "string", date: "string",
  timestamptz: "string", timestamp: "string", int2: "number", int4: "number", int8: "number",
  numeric: "number", float4: "number", float8: "number", bool: "boolean", jsonb: "Json", json: "Json",
  smallint: "number", integer: "number", bigint: "number", boolean: "boolean", void: "undefined",
};

const pad = (n: number) => "  ".repeat(n);

function tsType(udt: string, enums: Map<string, string[]>): string {
  const name = udt.replace(/^public\./, "");
  if (enums.has(name)) return `Database["public"]["Enums"]["${name}"]`;
  if (SCALAR[name]) return SCALAR[name];
  throw new Error(`Tipo SQL sem mapeamento para TypeScript: ${udt}`);
}

export async function generateDatabaseTypes(): Promise<string> {
  const { pg } = await createTestDb();
  const q = async <T extends object>(sql: string) => (await pg.query<T>(sql)).rows;

  const enumRows = await q<{ name: string; label: string }>(`
    select t.typname as name, e.enumlabel as label
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' order by t.typname, e.enumsortorder`);
  const enums = new Map<string, string[]>();
  enumRows.forEach((r) => enums.set(r.name, [...(enums.get(r.name) ?? []), r.label]));

  const cols = await q<{ table: string; column: string; udt: string; nullable: boolean; has_default: boolean; always: boolean }>(`
    select c.table_name as "table", c.column_name as "column", c.udt_name as udt,
           (c.is_nullable = 'YES') as nullable, (c.column_default is not null) as has_default,
           (c.is_identity = 'YES' and c.identity_generation = 'ALWAYS') as always
    from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    order by c.table_name, c.ordinal_position`);
  const tables = new Map<string, typeof cols>();
  cols.forEach((c) => tables.set(c.table, [...(tables.get(c.table) ?? []), c]));

  const procs = await q<{ name: string; args: string; result: string }>(`
    select p.proname as name, pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute')
    order by p.proname`);

  let out = `// ARQUIVO GERADO por \`npm run db:types\` a partir de supabase/migrations — não edite à mão.\n`;
  out += `\n`;
  out += `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\n`;
  out += `export type Database = {\n${pad(1)}public: {\n${pad(2)}Tables: {\n`;

  for (const [table, list] of [...tables.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const field = (c: (typeof list)[number], mode: "row" | "insert" | "update") => {
      const t = tsType(c.udt, enums) + (c.nullable ? " | null" : "");
      if (mode === "row") return `${pad(5)}${c.column}: ${t};\n`;
      if (c.always) return `${pad(5)}${c.column}?: never;\n`;
      const optional = mode === "update" || c.nullable || c.has_default;
      return `${pad(5)}${c.column}${optional ? "?" : ""}: ${t};\n`;
    };
    out += `${pad(3)}${table}: {\n`;
    for (const [label, mode] of [["Row", "row"], ["Insert", "insert"], ["Update", "update"]] as const) {
      out += `${pad(4)}${label}: {\n${list.map((c) => field(c, mode)).join("")}${pad(4)}};\n`;
    }
    out += `${pad(4)}Relationships: [];\n${pad(3)}};\n`;
  }
  out += `${pad(2)}};\n${pad(2)}Views: { [_ in never]: never };\n${pad(2)}Functions: {\n`;

  for (const p of procs.filter((p) => !HIDDEN_FUNCTIONS.has(p.name))) {
    const args = p.args.trim() ? p.args.split(", ").map((a) => {
      const [name, ...rest] = a.trim().split(" ");
      return `${pad(5)}${name}: ${tsType(rest.join(" "), enums)}${NULLABLE_ARG.test(name) ? " | null" : ""};\n`;
    }).join("") : "";
    let returns: string;
    const table = p.result.match(/^TABLE\(([\s\S]*)\)$/);
    if (table) {
      const fields = table[1].split(", ").map((f) => {
        const [name, ...rest] = f.trim().split(" ");
        return `${name}: ${tsType(rest.join(" "), enums)}${NULLABLE_COLUMN.test(name) ? " | null" : ""}`;
      });
      returns = `Array<{ ${fields.join("; ")} }>`;
    } else returns = tsType(p.result, enums);
    out += `${pad(3)}${p.name}: {\n${pad(4)}Args: ${args ? `{\n${args}${pad(4)}}` : "Record<PropertyKey, never>"};\n${pad(4)}Returns: ${returns};\n${pad(3)}};\n`;
  }

  out += `${pad(2)}};\n${pad(2)}Enums: {\n`;
  for (const [name, labels] of [...enums.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    out += `${pad(3)}${name}: ${labels.map((l) => JSON.stringify(l)).join(" | ")};\n`;
  }
  out += `${pad(2)}};\n${pad(2)}CompositeTypes: { [_ in never]: never };\n${pad(1)}};\n};\n\n`;
  out += `type PublicSchema = Database["public"];\n`;
  out += `export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];\n`;
  out += `export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];\n`;
  out += `export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];\n`;
  out += `export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];\n`;
  out += `export type FunctionReturn<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"];\n`;
  return out;
}

export const TYPES_PATH = OUT;

async function main() {
  const generated = await generateDatabaseTypes();
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(OUT, "utf8"); } catch { /* não existe */ }
    if (current.replace(/\r\n/g, "\n") !== generated) {
      console.error("src/types/database.ts está desatualizado. Rode: npm run db:types");
      process.exit(1);
    }
    console.log("src/types/database.ts está em dia.");
    return;
  }
  writeFileSync(OUT, generated);
  console.log(`Escrito ${OUT}`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/gen-db-types.ts")) void main();
