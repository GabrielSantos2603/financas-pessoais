"use client";

import { createClient } from "@/lib/supabase/client";
import { createDemoDb } from "@/demo/client";
import { isDemo } from "@/lib/demo";
import type { Db } from "@/services/db";

let client: Db | null = null;

/** Cliente Supabase do navegador (um só por aba). */
export const getDb = (): Db => (client ??= isDemo ? createDemoDb() : createClient());
