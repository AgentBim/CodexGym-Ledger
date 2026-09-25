export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          entity_id: string
          entity_type: string
          entity_version: number | null
          id: string
          occurred_at: string
          operation_id: string
          owner_id: string
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          entity_id: string
          entity_type: string
          entity_version?: number | null
          id?: string
          occurred_at?: string
          operation_id: string
          owner_id: string
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          entity_id?: string
          entity_type?: string
          entity_version?: number | null
          id?: string
          occurred_at?: string
          operation_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_owner_id_operation_id_fkey"
            columns: ["owner_id", "operation_id"]
            isOneToOne: false
            referencedRelation: "mutation_operations"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      daily_reviews: {
        Row: {
          created_operation_id: string
          id: string
          owner_id: string
          review_date: string
          reviewed_at: string
          version: number
        }
        Insert: {
          created_operation_id: string
          id?: string
          owner_id: string
          review_date: string
          reviewed_at?: string
          version?: number
        }
        Update: {
          created_operation_id?: string
          id?: string
          owner_id?: string
          review_date?: string
          reviewed_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_reviews_owner_id_created_operation_id_fkey"
            columns: ["owner_id", "created_operation_id"]
            isOneToOne: false
            referencedRelation: "mutation_operations"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      mutation_operations: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          operation_kind: string
          owner_id: string
          request_hash: string
          result: Json | null
          state: Database["public"]["Enums"]["operation_state"]
          undo_expires_at: string | null
          undo_operation_id: string | null
          undone_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          operation_kind: string
          owner_id: string
          request_hash: string
          result?: Json | null
          state?: Database["public"]["Enums"]["operation_state"]
          undo_expires_at?: string | null
          undo_operation_id?: string | null
          undone_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          operation_kind?: string
          owner_id?: string
          request_hash?: string
          result?: Json | null
          state?: Database["public"]["Enums"]["operation_state"]
          undo_expires_at?: string | null
          undo_operation_id?: string | null
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mutation_operations_owner_id_undo_operation_id_fkey"
            columns: ["owner_id", "undo_operation_id"]
            isOneToOne: false
            referencedRelation: "mutation_operations"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          created_operation_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          owner_id: string
          payment_date: string
          replacement_payment_id: string | null
          student_id: string
          updated_at: string
          version: number
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_operation_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          owner_id: string
          payment_date: string
          replacement_payment_id?: string | null
          student_id: string
          updated_at?: string
          version?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_operation_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          owner_id?: string
          payment_date?: string
          replacement_payment_id?: string | null
          student_id?: string
          updated_at?: string
          version?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_owner_id_created_operation_id_fkey"
            columns: ["owner_id", "created_operation_id"]
            isOneToOne: false
            referencedRelation: "mutation_operations"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "payments_owner_id_replacement_payment_id_fkey"
            columns: ["owner_id", "replacement_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "payments_owner_id_student_id_fkey"
            columns: ["owner_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      recurring_session_templates: {
        Row: {
          archived_at: string | null
          created_at: string
          ends_on: string | null
          id: string
          owner_id: string
          paused_at: string | null
          starts_on: string
          student_id: string
          updated_at: string
          version: number
          weekday: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          owner_id: string
          paused_at?: string | null
          starts_on: string
          student_id: string
          updated_at?: string
          version?: number
          weekday: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          owner_id?: string
          paused_at?: string | null
          starts_on?: string
          student_id?: string
          updated_at?: string
          version?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_session_templates_owner_id_student_id_fkey"
            columns: ["owner_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      sessions: {
        Row: {
          charge_rate_cents: number | null
          created_at: string
          created_operation_id: string
          id: string
          manually_edited_at: string | null
          occurrence_number: number
          owner_id: string
          session_date: string
          source: Database["public"]["Enums"]["session_source"]
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          template_id: string | null
          updated_at: string
          version: number
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          charge_rate_cents?: number | null
          created_at?: string
          created_operation_id: string
          id?: string
          manually_edited_at?: string | null
          occurrence_number?: number
          owner_id: string
          session_date: string
          source?: Database["public"]["Enums"]["session_source"]
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          template_id?: string | null
          updated_at?: string
          version?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          charge_rate_cents?: number | null
          created_at?: string
          created_operation_id?: string
          id?: string
          manually_edited_at?: string | null
          occurrence_number?: number
          owner_id?: string
          session_date?: string
          source?: Database["public"]["Enums"]["session_source"]
          status?: Database["public"]["Enums"]["session_status"]
          student_id?: string
          template_id?: string | null
          updated_at?: string
          version?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_owner_id_created_operation_id_fkey"
            columns: ["owner_id", "created_operation_id"]
            isOneToOne: false
            referencedRelation: "mutation_operations"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "sessions_owner_id_student_id_fkey"
            columns: ["owner_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "sessions_owner_id_template_id_fkey"
            columns: ["owner_id", "template_id"]
            isOneToOne: false
            referencedRelation: "recurring_session_templates"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      students: {
        Row: {
          archived_at: string | null
          created_at: string
          default_rate_cents: number
          id: string
          name: string
          notes: string | null
          owner_id: string
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          default_rate_cents?: number
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          default_rate_cents?: number
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      preview_template_schedule: {
        Args: {
          p_ends_on: string | null
          p_expected_version: number
          p_starts_on: string
          p_template_id: string
          p_weekday: number
        }
        Returns: Json
      }
      save_template_schedule: {
        Args: {
          p_archived: boolean
          p_ends_on: string | null
          p_expected_version: number
          p_future_mode: string
          p_idempotency_key: string
          p_paused: boolean
          p_request_hash: string
          p_starts_on: string
          p_student_id: string
          p_template_id: string
          p_weekday: number
        }
        Returns: Json
      }
      bulk_mark_attended: {
        Args: {
          p_idempotency_key: string
          p_request_hash: string
          p_session_date: string
          p_student_ids: string[]
        }
        Returns: Json
      }
      correct_payment: {
        Args: {
          p_expected_version: number
          p_idempotency_key: string
          p_payment_id: string
          p_replacement_amount_cents: number | null
          p_replacement_date: string | null
          p_replacement_method: Database["public"]["Enums"]["payment_method"] | null
          p_replacement_notes: string | null
          p_request_hash: string
          p_void_reason: string
        }
        Returns: Json
      }
      log_payment: {
        Args: {
          p_amount_cents: number
          p_idempotency_key: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes?: string | null
          p_payment_date: string
          p_request_hash: string
          p_student_id: string
        }
        Returns: Json
      }
      mark_daily_reviewed: {
        Args: {
          p_idempotency_key: string
          p_request_hash: string
          p_review_date: string
        }
        Returns: Json
      }
      materialize_recurring_sessions: {
        Args: {
          p_idempotency_key: string
          p_request_hash: string
          p_through_date?: string | null
        }
        Returns: Json
      }
      save_session: {
        Args: {
          p_expected_version: number | null
          p_idempotency_key: string
          p_request_hash: string
          p_session_date: string
          p_session_id: string | null
          p_status: Database["public"]["Enums"]["session_status"]
          p_student_id: string
          p_void: boolean
          p_void_reason: string | null
        }
        Returns: Json
      }
      save_student: {
        Args: {
          p_archived: boolean
          p_default_rate_cents: number
          p_expected_version: number | null
          p_idempotency_key: string
          p_name: string
          p_notes: string | null
          p_request_hash: string
          p_student_id: string | null
        }
        Returns: Json
      }
      save_template: {
        Args: {
          p_archived: boolean
          p_ends_on: string | null
          p_expected_version: number | null
          p_idempotency_key: string
          p_paused: boolean
          p_request_hash: string
          p_starts_on: string
          p_student_id: string
          p_template_id: string | null
          p_weekday: number
        }
        Returns: Json
      }
      undo_operation: {
        Args: {
          p_idempotency_key: string
          p_operation_id: string
          p_request_hash: string
        }
        Returns: Json
      }
    }
    Enums: {
      operation_state: "started" | "completed" | "failed"
      payment_method: "cash" | "transfer" | "other"
      session_source: "manual" | "bulk_attendance" | "recurrence"
      session_status: "scheduled" | "held" | "canceled" | "no_show"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      operation_state: ["started", "completed", "failed"],
      payment_method: ["cash", "transfer", "other"],
      session_source: ["manual", "bulk_attendance", "recurrence"],
      session_status: ["scheduled", "held", "canceled", "no_show"],
    },
  },
} as const


export type SessionStatus = Database["public"]["Enums"]["session_status"]
export type PaymentMethod = Database["public"]["Enums"]["payment_method"]
export type StudentRow = Database["public"]["Tables"]["students"]["Row"]
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"]
