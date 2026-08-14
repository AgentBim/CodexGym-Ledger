"use server";

import { createHash } from "node:crypto";
import { requireUser } from "@/lib/supabase/server";
import {
  bulkAttendanceSchema,
  correctPaymentSchema,
  logPaymentSchema,
  markDailyReviewedSchema,
  recurrenceGenerationSchema,
  saveSessionSchema,
  saveStudentSchema,
  saveTemplateSchema,
  undoOperationSchema,
} from "@/lib/validation/mutations";
import type { Json } from "@/lib/supabase/database.types";

export type MutationResult =
  | { ok: true; data: Json }
  | { ok: false; code: "VALIDATION"; fields: Record<string, string[]> }
  | { ok: false; code: "AUTH_REQUIRED" | "CONFLICT" | "NOT_FOUND" | "EXPIRED" | "INVALID" | "DATABASE"; message: string };

function hashRequest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validationFailure(error: { flatten(): { fieldErrors: Record<string, string[]> } }): MutationResult {
  return { ok: false, code: "VALIDATION", fields: error.flatten().fieldErrors };
}

function databaseFailure(error: { message: string; code?: string }): MutationResult {
  const { message } = error;
  if (message.includes("idempotency_conflict") || message.includes("stale_operation")) return { ok: false, code: "CONFLICT", message: "This request conflicts with a newer or different change." };
  if (message.includes("undo_expired")) return { ok: false, code: "EXPIRED", message: "The undo window has expired." };
  if (message.includes("not_found")) return { ok: false, code: "NOT_FOUND", message: "The requested record was not found." };
  if (error.code === "23505" || error.code === "23503" || message.includes("session_exists")) return { ok: false, code: "CONFLICT", message: "This change conflicts with an existing or newer record." };
  if (message.includes("invalid_") || message.includes("student_archived") || message.includes("student_mismatch") || message.includes("duplicate_students")) {
    return { ok: false, code: "INVALID", message: "The change is not valid for the record's current state." };
  }
  return { ok: false, code: "DATABASE", message: "The change could not be saved. Your entered values are safe to retry." };
}

async function authenticatedClient(): Promise<Awaited<ReturnType<typeof requireUser>> | MutationResult> {
  try { return await requireUser(); }
  catch { return { ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." }; }
}

export async function logPayment(input: unknown): Promise<MutationResult> {
  const parsed = logPaymentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined, notes: parsed.data.notes ?? null };
  const { data, error } = await auth.supabase.rpc("log_payment", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_student_id: parsed.data.studentId,
    p_payment_date: parsed.data.paymentDate,
    p_amount_cents: parsed.data.amountCents,
    p_method: parsed.data.method,
    p_notes: parsed.data.notes ?? null,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}

export async function bulkMarkAttended(input: unknown): Promise<MutationResult> {
  const parsed = bulkAttendanceSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined };
  const { data, error } = await auth.supabase.rpc("bulk_mark_attended", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_session_date: parsed.data.sessionDate,
    p_student_ids: parsed.data.studentIds,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}

export async function materializeRecurringSessions(input: unknown): Promise<MutationResult> {
  const parsed = recurrenceGenerationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined, throughDate: parsed.data.throughDate ?? null };
  const { data, error } = await auth.supabase.rpc("materialize_recurring_sessions", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_through_date: parsed.data.throughDate ?? null,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}

export async function undoOperation(input: unknown): Promise<MutationResult> {
  const parsed = undoOperationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined };
  const { data, error } = await auth.supabase.rpc("undo_operation", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_operation_id: parsed.data.operationId,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}

export async function saveStudent(input: unknown): Promise<MutationResult> {
  const parsed = saveStudentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = {
    ...parsed.data,
    idempotencyKey: undefined,
    studentId: parsed.data.studentId ?? null,
    notes: parsed.data.notes ?? null,
    expectedVersion: parsed.data.expectedVersion ?? null,
  };
  const { data, error } = await auth.supabase.rpc("save_student", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_student_id: parsed.data.studentId ?? null,
    p_name: parsed.data.name,
    p_default_rate_cents: parsed.data.defaultRateCents,
    p_notes: parsed.data.notes ?? null,
    p_archived: parsed.data.archived,
    p_expected_version: parsed.data.expectedVersion ?? null,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}

export async function saveTemplate(input: unknown): Promise<MutationResult> {
  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = {
    ...parsed.data,
    idempotencyKey: undefined,
    templateId: parsed.data.templateId ?? null,
    endsOn: parsed.data.endsOn ?? null,
    expectedVersion: parsed.data.expectedVersion ?? null,
  };
  const { data, error } = await auth.supabase.rpc("save_template", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_template_id: parsed.data.templateId ?? null,
    p_student_id: parsed.data.studentId,
    p_weekday: parsed.data.weekday,
    p_starts_on: parsed.data.startsOn,
    p_ends_on: parsed.data.endsOn ?? null,
    p_paused: parsed.data.paused,
    p_archived: parsed.data.archived,
    p_expected_version: parsed.data.expectedVersion ?? null,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}

export async function saveSession(input: unknown): Promise<MutationResult> {
  const parsed = saveSessionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = {
    ...parsed.data,
    idempotencyKey: undefined,
    sessionId: parsed.data.sessionId ?? null,
    voidReason: parsed.data.voidReason ?? null,
    expectedVersion: parsed.data.expectedVersion ?? null,
  };
  const { data, error } = await auth.supabase.rpc("save_session", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_session_id: parsed.data.sessionId ?? null,
    p_student_id: parsed.data.studentId,
    p_session_date: parsed.data.sessionDate,
    p_status: parsed.data.status,
    p_void: parsed.data.void,
    p_void_reason: parsed.data.voidReason ?? null,
    p_expected_version: parsed.data.expectedVersion ?? null,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}

export async function correctPayment(input: unknown): Promise<MutationResult> {
  const parsed = correctPaymentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = {
    ...parsed.data,
    idempotencyKey: undefined,
    replacement: parsed.data.replacement ? {
      ...parsed.data.replacement,
      notes: parsed.data.replacement.notes ?? null,
    } : null,
  };
  const replacement = parsed.data.replacement;
  const { data, error } = await auth.supabase.rpc("correct_payment", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_payment_id: parsed.data.paymentId,
    p_expected_version: parsed.data.expectedVersion,
    p_void_reason: parsed.data.voidReason,
    p_replacement_date: replacement?.paymentDate ?? null,
    p_replacement_amount_cents: replacement?.amountCents ?? null,
    p_replacement_method: replacement?.method ?? null,
    p_replacement_notes: replacement?.notes ?? null,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}

export async function markDailyReviewed(input: unknown): Promise<MutationResult> {
  const parsed = markDailyReviewedSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined };
  const { data, error } = await auth.supabase.rpc("mark_daily_reviewed", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_review_date: parsed.data.reviewDate,
  });
  return error ? databaseFailure(error) : { ok: true, data };
}
