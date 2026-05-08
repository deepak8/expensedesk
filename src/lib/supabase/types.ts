// Auto-maintained by hand for Phase 1A.
// Replace with `supabase gen types typescript` output once CLI is configured.

export type ExpenseType = "manual" | "receipt" | "salary" | "reimbursement";
export type ExpenseStatus = "draft" | "needs_review" | "verified" | "missing_receipt";

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
      };
      payment_methods: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          expense_date: string;
          vendor: string;
          description: string | null;
          amount: number;
          currency: string;
          category_id: number | null;
          payment_method_id: number | null;
          expense_type: ExpenseType;
          status: ExpenseStatus;
          receipt_file_path: string | null;
          invoice_number: string | null;
          ai_confidence: number | null;
          raw_ai_json: Record<string, unknown> | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_date: string;
          vendor: string;
          description?: string | null;
          amount: number;
          currency?: string;
          category_id?: number | null;
          payment_method_id?: number | null;
          expense_type?: ExpenseType;
          status?: ExpenseStatus;
          receipt_file_path?: string | null;
          invoice_number?: string | null;
          ai_confidence?: number | null;
          raw_ai_json?: Record<string, unknown> | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          expense_date?: string;
          vendor?: string;
          description?: string | null;
          amount?: number;
          currency?: string;
          category_id?: number | null;
          payment_method_id?: number | null;
          expense_type?: ExpenseType;
          status?: ExpenseStatus;
          receipt_file_path?: string | null;
          invoice_number?: string | null;
          ai_confidence?: number | null;
          raw_ai_json?: Record<string, unknown> | null;
          notes?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      expense_type: ExpenseType;
      expense_status: ExpenseStatus;
    };
  };
}

// ─── Convenience row types ────────────────────────────────────────────────────

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];

// ─── Joined / enriched type used across the UI ───────────────────────────────

export interface ExpenseWithRefs extends ExpenseRow {
  category_name: string | null;
  payment_method_name: string | null;
}
