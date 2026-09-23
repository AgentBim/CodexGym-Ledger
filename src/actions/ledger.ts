"use server";

import { createHash } from "node:crypto";
import { requireUser } from "@/lib/supabase/server";
import {
  assignPackageSchema,
  bulkAttendanceSchema,
  createPackageDefinitionSchema,
  logPaymentSchema,
  recurrenceGenerationSchema,
  setPackageArchivedSchema,
  undoOperationSchema,
} from "@/lib/validation/mutations";
import type { Json } from "@/lib/supabase/database.types";

export type MutationResult =
  | { ok: true; data: Json }
  | { ok: false; code: "VALIDATION"; fields: Record<string, string[]> }
  | { ok: false; code: "AUTH_REQUIRED" | "CONFLICT" | "NOT_FOUND" | "EXPIRED" | "DATABASE"; message: string };

function hashRequest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validationFailure(error: { flatten(): { fieldErrors: Record<string, string[]> } }): MutationResult {
  return { ok: false, code: "VALIDATION", fields: error.flatten().fieldErrors };
}

function databaseFailure(message: string): MutationResult {
  if (message.includes("idempotency_conflict") || message.includes("stale_operation")) return { ok: false, code: "CONFLICT", message: "This request conflicts with a newer or different change." };
  if (message.includes("undo_expired")) return { ok: false, code: "EXPIRED", message: "The undo window has expired." };
  if (message.includes("invalid_dates") || message.includes("invalid_class_count")) return { ok: false, code: "VALIDATION", fields: {} };
  if (message.includes("not_found")) return { ok: false, code: "NOT_FOUND", message: "The requested record was not found." };
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
  const request = { ...parsed.data, idempotencyKey: undefined };
  const { data, error } = await auth.supabase.rpc("log_payment", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_student_id: parsed.data.studentId,
    p_payment_date: parsed.data.paymentDate,
    p_amount_cents: parsed.data.amountCents,
    p_method: parsed.data.method,
    p_notes: parsed.data.notes ?? null,
  });
  return error ? databaseFailure(error.message) : { ok: true, data };
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
  return error ? databaseFailure(error.message) : { ok: true, data };
}

export async function materializeRecurringSessions(input: unknown): Promise<MutationResult> {
  const parsed = recurrenceGenerationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined };
  const { data, error } = await auth.supabase.rpc("materialize_recurring_sessions", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_through_date: parsed.data.throughDate ?? null,
  });
  return error ? databaseFailure(error.message) : { ok: true, data };
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
  return error ? databaseFailure(error.message) : { ok: true, data };
}

export async function createPackageDefinition(input: unknown): Promise<MutationResult> {
  const parsed = createPackageDefinitionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined };
  const { data, error } = await auth.supabase.rpc("create_package_definition", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_kind: parsed.data.kind,
    p_class_count: parsed.data.classCount,
    p_price_cents: parsed.data.priceCents,
    p_validity_weeks: parsed.data.validityWeeks,
    p_active: parsed.data.active,
  });
  return error ? databaseFailure(error.message) : { ok: true, data };
}

export async function setPackageArchived(input: unknown): Promise<MutationResult> {
  const parsed = setPackageArchivedSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined };
  const { data, error } = await auth.supabase.rpc("set_package_archived", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_package_definition_id: parsed.data.packageDefinitionId,
    p_expected_version: parsed.data.expectedVersion,
    p_archived: parsed.data.archived,
  });
  return error ? databaseFailure(error.message) : { ok: true, data };
}

export async function assignPackage(input: unknown): Promise<MutationResult> {
  const parsed = assignPackageSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const auth = await authenticatedClient();
  if (!("supabase" in auth)) return auth;
  const request = { ...parsed.data, idempotencyKey: undefined };
  const { data, error } = await auth.supabase.rpc("assign_package", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_request_hash: hashRequest(request),
    p_student_id: parsed.data.studentId,
    p_package_definition_id: parsed.data.packageDefinitionId,
    p_starts_on: parsed.data.startsOn,
    p_ends_on: parsed.data.endsOn ?? null,
  });
  return error ? databaseFailure(error.message) : { ok: true, data };
}
