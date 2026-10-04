import type { Member } from "@/types/db";
import { ServiceError, unwrap, type Db } from "./db";

export async function createHousehold(db: Db, name: string, person: string) {
  unwrap(await db.rpc("create_household", { p_name: name, p_person: person }));
}

/** Entra pelo código. Código inexistente vira erro amigável (o banco devolve NULL de propósito, p/ contar tentativas). */
export async function joinHousehold(db: Db, code: string) {
  const id = unwrap(await db.rpc("join_household", { p_code: code })) as string | null;
  if (!id) throw new ServiceError("Código de convite inválido.");
}

export async function listMembers(db: Db): Promise<Member[]> {
  return unwrap(await db.from("household_members").select("*").order("role").order("created_at"));
}

export async function rotateInviteCode(db: Db): Promise<string> {
  return unwrap(await db.rpc("rotate_invite_code"));
}

export async function removeMember(db: Db, userId: string) {
  unwrap(await db.rpc("remove_member", { p_user: userId }));
}

export async function leaveHousehold(db: Db) {
  unwrap(await db.rpc("leave_household"));
}

export async function renameHousehold(db: Db, householdId: string, name: string) {
  unwrap(await db.from("households").update({ name: name.trim() }).eq("id", householdId));
}
