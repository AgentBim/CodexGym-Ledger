import { z } from "zod";

const isoDate = z.iso.date();
const idempotencyKey = z.uuid();

export const logPaymentSchema = z.object({
  idempotencyKey,
  studentId: z.uuid(),
  paymentDate: isoDate,
  amountCents: z.int().positive().max(100_000_000),
  method: z.enum(["cash", "transfer", "other"]),
  notes: z.string().trim().max(1_000).nullable().optional(),
}).strict();

export const bulkAttendanceSchema = z.object({
  idempotencyKey,
  sessionDate: isoDate,
  studentIds: z.array(z.uuid()).min(1).max(250).transform((ids) => [...new Set(ids)].sort()),
}).strict();

export const recurrenceGenerationSchema = z.object({
  idempotencyKey,
  throughDate: isoDate.optional(),
}).strict();

export const undoOperationSchema = z.object({
  idempotencyKey,
  operationId: z.uuid(),
}).strict();
