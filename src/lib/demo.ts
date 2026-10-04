/**
 * Modo demonstração: roda o app contra um Postgres embutido (PGlite) com dados fictícios,
 * sem precisar de Supabase. Só existe em desenvolvimento (`npm run dev:demo`);
 * em build de produção esta constante vira `false` e todo o caminho demo é descartado.
 */
export const isDemo = process.env.NEXT_PUBLIC_DEMO === "true" && process.env.NODE_ENV !== "production";
