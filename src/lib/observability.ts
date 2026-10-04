/**
 * Ponto ÚNICO para reportar erros inesperados. Hoje registra no console com contexto estruturado.
 * Para produção, conecte um serviço (ex.: Sentry) chamando `setErrorSink` uma vez no startup do cliente.
 */
export type ErrorContext = Record<string, unknown>;
export type ErrorSink = (error: unknown, context?: ErrorContext) => void;

let sink: ErrorSink = (error, context) => {
  console.error("[erro]", error, context ?? {});
};

export const setErrorSink = (next: ErrorSink) => { sink = next; };

export function reportError(error: unknown, context?: ErrorContext): void {
  try { sink(error, context); } catch { /* reportar erro nunca pode quebrar o app */ }
}
