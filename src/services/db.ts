import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Db = SupabaseClient<Database>;
export type Scope = "one" | "following";

export class ServiceError extends Error {
  constructor(message: string, readonly code?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ServiceError";
  }
}

interface RawError { message: string; code?: string }

/** Traduz erros do Postgres/PostgREST/rede em mensagens que o usuário entende. */
export function friendlyMessage(e: RawError): string {
  switch (e.code) {
    case "23503": return "Essa operação referencia um item que não existe (ou que é de outro espaço).";
    case "23505": return "Já existe um item com esse nome ou com esses dados.";
    case "23514": return "Algum valor informado é inválido.";
    case "23502": return "Faltou preencher um campo obrigatório.";
    case "22P02": return "Algum valor informado tem formato inválido.";
    case "42501": return "Você não tem permissão para fazer isso.";
    case "PGRST301": case "PGRST303": return "Sua sessão expirou. Entre novamente.";
    case "P0001": return e.message; // RAISE EXCEPTION das nossas funções: já está em português
  }
  if (/failed to fetch|network|load failed/i.test(e.message)) return "Sem conexão com o servidor. Verifique sua internet.";
  return e.message || "Algo deu errado. Tente novamente.";
}

export const toServiceError = (e: RawError): ServiceError => new ServiceError(friendlyMessage(e), e.code, { cause: e });

export function unwrap<T>(res: { data: T | null; error: RawError | null }): T {
  if (res.error) throw toServiceError(res.error);
  return res.data as T;
}

/** PostgREST limita cada resposta (padrão 1000 linhas): busca em páginas até acabar. */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: RawError | null }>,
  size = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += size) {
    const rows = unwrap(await page(from, from + size - 1));
    all.push(...rows);
    if (rows.length < size) return all;
  }
}
