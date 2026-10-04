// Sobe o app em MODO DEMONSTRAÇÃO: banco embutido + dados fictícios, sem Supabase.
//   npm run dev:demo            → http://localhost:3000
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_DEMO: "true",
    // valores só para passar na validação de ambiente; nada é enviado a lugar nenhum
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://demo.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "demo-anon-key-not-used-anywhere",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
