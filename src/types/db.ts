import type { Enums, FunctionReturn, Tables } from "./database";

// Tipos de domínio DERIVADOS do schema gerado (src/types/database.ts) — não declare colunas à mão aqui.
export type Kind = Enums<"tx_kind">;
export type Status = Enums<"tx_status">;
export type AccountKind = Enums<"account_kind">;
export type MemberRole = Enums<"member_role">;

export type Person = Tables<"people">;
export type Account = Tables<"accounts">;
export type Category = Tables<"categories">;
export type Transaction = Tables<"transactions">;
export type RecurringRule = Tables<"recurring_rules">;
export type Budget = Tables<"budgets">;
export type Member = Tables<"household_members">;
export type Household = Pick<Tables<"households">, "id" | "name" | "invite_code">;

export type PeriodSummaryRow = FunctionReturn<"period_summary">[number];
export type CategoryTotalRow = FunctionReturn<"category_totals">[number];
export type PersonTotalRow = FunctionReturn<"person_totals">[number];
export type InstallmentGroupRow = Omit<FunctionReturn<"installment_groups">[number], "focus"> & { focus: Transaction };
