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

export const createPackageDefinitionSchema = z.object({
  idempotencyKey,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).nullable().optional(),
  kind: z.enum(["class_pack", "time_based"]),
  classCount: z.int().min(1).max(200).nullable(),
  priceCents: z.int().min(0).max(10_000_000),
  validityWeeks: z.int().min(1).max(104).nullable(),
  active: z.boolean().default(true),
}).strict().refine((value) => (value.kind === "class_pack") === (value.classCount !== null), {
  path: ["classCount"],
  message: "Class packs need a class count; time-based packages must not have one.",
});

export const setPackageArchivedSchema = z.object({
  idempotencyKey,
  packageDefinitionId: z.uuid(),
  expectedVersion: z.int().positive(),
  archived: z.boolean(),
}).strict();

export const assignPackageSchema = z.object({
  idempotencyKey,
  studentId: z.uuid(),
  packageDefinitionId: z.uuid(),
  startsOn: isoDate,
  endsOn: isoDate.nullable().optional(),
}).strict().refine((value) => !value.endsOn || value.endsOn >= value.startsOn, {
  path: ["endsOn"],
  message: "End date must be on or after the start date.",
});
