// ARQUIVO GERADO por `npm run db:types` a partir de supabase/migrations — não edite à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          kind: Database["public"]["Enums"]["account_kind"];
          color: string;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          kind?: Database["public"]["Enums"]["account_kind"];
          color?: string;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          kind?: Database["public"]["Enums"]["account_kind"];
          color?: string;
          archived?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          household_id: string;
          category_id: string;
          month: string;
          amount_cents: number;
        };
        Insert: {
          id?: string;
          household_id: string;
          category_id: string;
          month: string;
          amount_cents: number;
        };
        Update: {
          id?: string;
          household_id?: string;
          category_id?: string;
          month?: string;
          amount_cents?: number;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          kind: Database["public"]["Enums"]["tx_kind"];
          icon: string;
          color: string;
          is_savings: boolean;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          kind: Database["public"]["Enums"]["tx_kind"];
          icon?: string;
          color?: string;
          is_savings?: boolean;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          kind?: Database["public"]["Enums"]["tx_kind"];
          icon?: string;
          color?: string;
          is_savings?: boolean;
          archived?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          household_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          email: string | null;
          created_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          email?: string | null;
          created_at?: string;
        };
        Update: {
          household_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      join_attempts: {
        Row: {
          id: number;
          user_id: string;
          attempted_at: string;
        };
        Insert: {
          id?: never;
          user_id: string;
          attempted_at?: string;
        };
        Update: {
          id?: never;
          user_id?: string;
          attempted_at?: string;
        };
        Relationships: [];
      };
      people: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          color: string;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          color?: string;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          color?: string;
          archived?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      recurring_rules: {
        Row: {
          id: string;
          household_id: string;
          kind: Database["public"]["Enums"]["tx_kind"];
          description: string;
          amount_cents: number;
          day_of_month: number;
          start_month: string;
          end_month: string | null;
          person_id: string | null;
          category_id: string | null;
          account_id: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          kind: Database["public"]["Enums"]["tx_kind"];
          description: string;
          amount_cents?: number;
          day_of_month: number;
          start_month: string;
          end_month?: string | null;
          person_id?: string | null;
          category_id?: string | null;
          account_id?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          kind?: Database["public"]["Enums"]["tx_kind"];
          description?: string;
          amount_cents?: number;
          day_of_month?: number;
          start_month?: string;
          end_month?: string | null;
          person_id?: string | null;
          category_id?: string | null;
          account_id?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          household_id: string;
          kind: Database["public"]["Enums"]["tx_kind"];
          description: string;
          amount_cents: number;
          due_date: string;
          status: Database["public"]["Enums"]["tx_status"];
          settled_at: string | null;
          person_id: string | null;
          category_id: string | null;
          account_id: string | null;
          installment_group: string | null;
          installment_number: number | null;
          installment_total: number | null;
          recurring_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          kind: Database["public"]["Enums"]["tx_kind"];
          description: string;
          amount_cents: number;
          due_date: string;
          status?: Database["public"]["Enums"]["tx_status"];
          settled_at?: string | null;
          person_id?: string | null;
          category_id?: string | null;
          account_id?: string | null;
          installment_group?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          recurring_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          kind?: Database["public"]["Enums"]["tx_kind"];
          description?: string;
          amount_cents?: number;
          due_date?: string;
          status?: Database["public"]["Enums"]["tx_status"];
          settled_at?: string | null;
          person_id?: string | null;
          category_id?: string | null;
          account_id?: string | null;
          installment_group?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          recurring_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      category_totals: {
        Args: {
          p_from: string;
          p_to: string;
        };
        Returns: Array<{ category_id: string | null; total_cents: number }>;
      };
      copy_budgets: {
        Args: {
          p_from: string;
          p_to: string;
        };
        Returns: number;
      };
      create_household: {
        Args: {
          p_name: string;
          p_person: string;
        };
        Returns: string;
      };
      create_installments: {
        Args: {
          p_kind: Database["public"]["Enums"]["tx_kind"];
          p_description: string;
          p_amount_cents: number;
          p_amount_is_total: boolean;
          p_first_due: string;
          p_total: number;
          p_current: number;
          p_person_id: string | null;
          p_category_id: string | null;
          p_account_id: string | null;
          p_notes: string | null;
          p_first_done: boolean;
          p_today: string | null;
        };
        Returns: string;
      };
      create_recurring: {
        Args: {
          p_kind: Database["public"]["Enums"]["tx_kind"];
          p_description: string;
          p_amount_cents: number;
          p_day: number;
          p_start_month: string;
          p_person_id: string | null;
          p_category_id: string | null;
          p_account_id: string | null;
          p_first_done: boolean;
          p_today: string | null;
        };
        Returns: string;
      };
      delete_recurring: {
        Args: {
          p_id: string;
          p_from: string;
        };
        Returns: number;
      };
      delete_transactions: {
        Args: {
          p_id: string;
          p_scope: string;
        };
        Returns: number;
      };
      import_transactions: {
        Args: {
          p_rows: Json;
        };
        Returns: Json;
      };
      installment_groups: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{ group_id: string; description: string; category_id: string | null; person_id: string | null; total: number; paid_count: number; pending_count: number; remaining_cents: number; last_due: string; focus: Json }>;
      };
      join_household: {
        Args: {
          p_code: string;
        };
        Returns: string;
      };
      leave_household: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      materialize_recurring: {
        Args: {
          p_month: string;
        };
        Returns: number;
      };
      period_summary: {
        Args: {
          p_from: string;
          p_to: string;
        };
        Returns: Array<{ month: string; income_cents: number; income_done_cents: number; expense_cents: number; expense_done_cents: number; saved_cents: number; saved_done_cents: number }>;
      };
      person_totals: {
        Args: {
          p_from: string;
          p_to: string;
        };
        Returns: Array<{ person_id: string | null; total_cents: number }>;
      };
      remove_member: {
        Args: {
          p_user: string;
        };
        Returns: undefined;
      };
      rotate_invite_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      update_recurring: {
        Args: {
          p_id: string;
          p_description: string;
          p_amount_cents: number;
          p_day: number;
          p_person_id: string | null;
          p_category_id: string | null;
          p_account_id: string | null;
          p_active: boolean;
          p_from_month: string;
        };
        Returns: number;
      };
      update_transaction: {
        Args: {
          p_id: string;
          p_scope: string;
          p_kind: Database["public"]["Enums"]["tx_kind"];
          p_description: string;
          p_amount_cents: number;
          p_due_date: string;
          p_done: boolean;
          p_person_id: string | null;
          p_category_id: string | null;
          p_account_id: string | null;
          p_notes: string | null;
          p_today: string | null;
        };
        Returns: number;
      };
    };
    Enums: {
      account_kind: "checking" | "card" | "cash" | "savings" | "investment";
      member_role: "owner" | "member";
      tx_kind: "income" | "expense";
      tx_status: "pending" | "done";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
export type FunctionReturn<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"];
