"use client";

import { createClient } from "@/lib/supabase/client";
import type { Db } from "@/services/db";

let client: Db | null = null;

/** Cliente Supabase do navegador (um só por aba). */
export const getDb = (): Db => (client ??= createClient());
