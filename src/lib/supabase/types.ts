// Auto-maintained by hand for Phase 1A+3C.
// Replace with `supabase gen types typescript` output once CLI is configured.

export type ExpenseType = "manual" | "receipt" | "salary" | "reimbursement" | "invoice";
export type ExpenseStatus = "draft" | "needs_review" | "verified" | "missing_receipt";
export type DocumentType = "invoice" | "receipt" | "payment_proof" | "manual" | "salary";
export type PaymentStatus = "unpaid" | "partially_paid" | "paid";
export type WorkerType = "employee" | "contractor" | "freelancer" | "other";
export type PaymentCycle = "monthly" | "weekly" | "ad_hoc";

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: number;
          name: string;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          name: string;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          is_active?: boolean;
        };
      };
      payment_methods: {
        Row: {
          id: number;
          name: string;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          name: string;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          is_active?: boolean;
        };
      };
      business_settings: {
        Row: {
          id: string;
          business_name: string | null;
          default_currency: string;
          contact_email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name?: string | null;
          default_currency?: string;
          contact_email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          business_name?: string | null;
          default_currency?: string;
          contact_email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
        };
      };
      employees: {
        Row: {
          id: string;
          name: string;
          worker_type: WorkerType;
          role: string | null;
          department: string | null;
          email: string | null;
          phone: string | null;
          default_salary: number | null;
          default_payment_method_id: number | null;
          payment_cycle: PaymentCycle;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          worker_type?: WorkerType;
          role?: string | null;
          department?: string | null;
          email?: string | null;
          phone?: string | null;
          default_salary?: number | null;
          default_payment_method_id?: number | null;
          payment_cycle?: PaymentCycle;
          is_active?: boolean;
          notes?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          worker_type?: WorkerType;
          role?: string | null;
          department?: string | null;
          email?: string | null;
          phone?: string | null;
          default_salary?: number | null;
          default_payment_method_id?: number | null;
          payment_cycle?: PaymentCycle;
          is_active?: boolean;
          notes?: string | null;
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
          employee_id: string | null;
          expense_type: ExpenseType;
          status: ExpenseStatus;
          receipt_file_path: string | null;
          invoice_number: string | null;
          ai_confidence: number | null;
          raw_ai_json: Record<string, unknown> | null;
          notes: string | null;
          document_type: DocumentType;
          payment_status: PaymentStatus;
          due_date: string | null;
          payment_date: string | null;
          paid_amount: number | null;
          payment_reference: string | null;
          payment_proof_file_path: string | null;
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
          employee_id?: string | null;
          expense_type?: ExpenseType;
          status?: ExpenseStatus;
          receipt_file_path?: string | null;
          invoice_number?: string | null;
          ai_confidence?: number | null;
          raw_ai_json?: Record<string, unknown> | null;
          notes?: string | null;
          document_type?: DocumentType;
          payment_status?: PaymentStatus;
          due_date?: string | null;
          payment_date?: string | null;
          paid_amount?: number | null;
          payment_reference?: string | null;
          payment_proof_file_path?: string | null;
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
          employee_id?: string | null;
          expense_type?: ExpenseType;
          status?: ExpenseStatus;
          receipt_file_path?: string | null;
          invoice_number?: string | null;
          ai_confidence?: number | null;
          raw_ai_json?: Record<string, unknown> | null;
          notes?: string | null;
          document_type?: DocumentType;
          payment_status?: PaymentStatus;
          due_date?: string | null;
          payment_date?: string | null;
          paid_amount?: number | null;
          payment_reference?: string | null;
          payment_proof_file_path?: string | null;
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
export type BusinessSettingsRow = Database["public"]["Tables"]["business_settings"]["Row"];
export type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];

// ─── Joined / enriched type used across the UI ───────────────────────────────

export interface ExpenseWithRefs extends ExpenseRow {
  category_name: string | null;
  payment_method_name: string | null;
  employee_name: string | null;
}
