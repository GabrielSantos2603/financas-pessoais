/** Arte do ícone do app (usada pelo ImageResponse): gradiente da marca + linha de gráfico crescente. */
export function AppIconArt({ size, maskable = false }: { size: number; maskable?: boolean }) {
  // Ícones "maskable" precisam de uma margem de segurança (~20%) porque o sistema recorta em círculo/squircle.
  const pad = maskable ? size * 0.2 : size * 0.14;
  const inner = size - pad * 2;
  return (
    <div
      style={{
        width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #5b3df5 0%, #8f3df0 100%)",
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 100 100" fill="none">
        <path d="M14 70 L38 46 L54 60 L84 28" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="84" cy="28" r="9" fill="#34d399" />
      </svg>
    </div>
  );
}
