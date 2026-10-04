import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes e resolve conflitos do Tailwind (a última vence: `cn("inline-flex", "hidden")` → "hidden"). */
export const cn = (...v: ClassValue[]) => twMerge(clsx(v));
