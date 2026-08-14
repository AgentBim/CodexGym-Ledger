-- Applied follow-up to initial_gym_ledger_schema.
-- Covers composite foreign keys in their declared column order so parent-row
-- checks and future maintenance do not require avoidable child-table scans.

create index audit_owner_operation_id_idx
  on public.audit_events (owner_id, operation_id);

create index daily_reviews_owner_operation_id_idx
  on public.daily_reviews (owner_id, created_operation_id);

create index operations_owner_undo_operation_id_idx
  on public.mutation_operations (owner_id, undo_operation_id)
  where undo_operation_id is not null;

create index payments_owner_created_operation_id_idx
  on public.payments (owner_id, created_operation_id);

create index payments_owner_replacement_payment_id_idx
  on public.payments (owner_id, replacement_payment_id)
  where replacement_payment_id is not null;

create index templates_owner_student_id_idx
  on public.recurring_session_templates (owner_id, student_id);

create index sessions_owner_created_operation_id_idx
  on public.sessions (owner_id, created_operation_id);
