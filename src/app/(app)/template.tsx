/** `template` remonta a cada navegação: a tela nova entra com uma animação suave (sensação de app nativo). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
