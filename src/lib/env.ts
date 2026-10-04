import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL deve ser uma URL (https://xxxx.supabase.co)" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, { error: "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente ou curta demais" }),
});

// As variáveis NEXT_PUBLIC_* precisam ser lidas literalmente para o Next inlinar no bundle do navegador.
const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
  throw new Error(`Configuração inválida. Preencha .env.local (veja .env.example):\n${problems}`);
}

export const env = parsed.data;
