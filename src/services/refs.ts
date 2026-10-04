import type { Account, Category, Person } from "@/types/db";
import type { TablesInsert } from "@/types/database";
import { unwrap, type Db } from "./db";

export interface Refs { people: Person[]; accounts: Account[]; categories: Category[] }

export async function fetchRefs(db: Db): Promise<Refs> {
  const [people, accounts, categories] = await Promise.all([
    db.from("people").select("*").order("created_at"),
    db.from("accounts").select("*").order("created_at"),
    db.from("categories").select("*").order("name"),
  ]);
  return { people: unwrap(people), accounts: unwrap(accounts), categories: unwrap(categories) };
}

export type PersonInput = Omit<TablesInsert<"people">, "household_id" | "created_at"> & { id?: string };
export type AccountInput = Omit<TablesInsert<"accounts">, "household_id" | "created_at"> & { id?: string };
export type CategoryInput = Omit<TablesInsert<"categories">, "household_id" | "created_at"> & { id?: string };

export async function savePerson(db: Db, householdId: string, { id, ...row }: PersonInput) {
  unwrap(id ? await db.from("people").update(row).eq("id", id) : await db.from("people").insert({ ...row, household_id: householdId }));
}
export async function saveAccount(db: Db, householdId: string, { id, ...row }: AccountInput) {
  unwrap(id ? await db.from("accounts").update(row).eq("id", id) : await db.from("accounts").insert({ ...row, household_id: householdId }));
}
export async function saveCategory(db: Db, householdId: string, { id, ...row }: CategoryInput) {
  unwrap(id ? await db.from("categories").update(row).eq("id", id) : await db.from("categories").insert({ ...row, household_id: householdId }));
}

export async function deleteEntity(db: Db, table: "people" | "accounts" | "categories", id: string) {
  if (table === "people") unwrap(await db.from("people").delete().eq("id", id));
  else if (table === "accounts") unwrap(await db.from("accounts").delete().eq("id", id));
  else unwrap(await db.from("categories").delete().eq("id", id));
}
