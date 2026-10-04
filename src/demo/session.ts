import "server-only";
import type { Household } from "@/types/db";
import { DEMO_EMAIL } from "./seed";
import { getDemoDb } from "./server-db";

/** "Sessão" fixa do modo demonstração (no lugar do login do Supabase). */
export async function getDemoSession(): Promise<{ household: Household; userId: string; email: string }> {
  const demo = await getDemoDb();
  const [household] = await demo.run((q) => q<Household>("select id, name, invite_code from households"));
  return { household, userId: demo.userId, email: DEMO_EMAIL };
}
