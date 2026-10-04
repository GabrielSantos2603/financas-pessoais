"use client";

import { createContext, useContext } from "react";
import type { Household } from "@/types/db";

export interface AppCtx { household: Household; userId: string; email: string }
const Ctx = createContext<AppCtx | null>(null);
export const AppProvider = Ctx.Provider;
export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fora do AppProvider");
  return v;
}
