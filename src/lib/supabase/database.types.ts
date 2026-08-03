export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SessionStatus = "scheduled" | "held" | "canceled" | "no_show";
export type PaymentMethod = "cash" | "transfer" | "other";

type BaseRow = {
  id: string;
  owner_id: string;
  version: number;
  created_at: string;
};

export type StudentRow = BaseRow & {
  name: string;
  default_rate_cents: number;
  notes: string | null;
  archived_at: string | null;
  updated_at: string;
};

export type SessionRow = BaseRow & {
  student_id: string;
  template_id: string | null;
  session_date: string;
  status: SessionStatus;
  charge_rate_cents: number | null;
  occurrence_number: number;
  source: "manual" | "bulk_attendance" | "recurrence";
  manually_edited_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_operation_id: string;
  updated_at: string;
};

export type PaymentRow = BaseRow & {
  student_id: string;
  payment_date: string;
  amount_cents: number;
  method: PaymentMethod;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
  replacement_payment_id: string | null;
  created_operation_id: string;
  updated_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      students: Table<StudentRow>;
      sessions: Table<SessionRow>;
      payments: Table<PaymentRow>;
      recurring_session_templates: Table<Record<string, unknown>>;
      mutation_operations: Table<Record<string, unknown>>;
      audit_events: Table<Record<string, unknown>>;
      daily_reviews: Table<Record<string, unknown>>;
    };
    Views: Record<string, never>;
    Functions: {
      log_payment: {
        Args: { p_idempotency_key: string; p_request_hash: string; p_student_id: string; p_payment_date: string; p_amount_cents: number; p_method: PaymentMethod; p_notes?: string | null };
        Returns: Json;
      };
      bulk_mark_attended: {
        Args: { p_idempotency_key: string; p_request_hash: string; p_session_date: string; p_student_ids: string[] };
        Returns: Json;
      };
      materialize_recurring_sessions: {
        Args: { p_idempotency_key: string; p_request_hash: string; p_through_date?: string | null };
        Returns: Json;
      };
      undo_operation: {
        Args: { p_idempotency_key: string; p_request_hash: string; p_operation_id: string };
        Returns: Json;
      };
    };
    Enums: {
      session_status: SessionStatus;
      payment_method: PaymentMethod;
      session_source: "manual" | "bulk_attendance" | "recurrence";
      operation_state: "started" | "completed" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
};
