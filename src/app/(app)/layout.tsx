import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import type { Household } from "@/types/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("households(id, name, invite_code)")
    .eq("user_id", user.id)
    .maybeSingle();

  const household = (membership as unknown as { households: Household } | null)?.households;
  if (!household) redirect("/onboarding");

  return (
    <AppShell household={household} userId={user.id} email={user.email ?? ""}>
      <Suspense>{children}</Suspense>
    </AppShell>
  );
}
