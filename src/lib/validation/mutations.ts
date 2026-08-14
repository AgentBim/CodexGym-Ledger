import { z } from "zod";

const isoDate = z.iso.date();
const idempotencyKey = z.uuid();
const optionalNote = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();

export const logPaymentSchema = z.object({
  idempotencyKey,
  studentId: z.uuid(),
  paymentDate: isoDate,
  amountCents: z.int().positive().max(100_000_000),
  method: z.enum(["cash", "transfer", "other"]),
  notes: optionalNote(1_000),
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

export const saveStudentSchema = z.object({
  idempotencyKey,
  studentId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  defaultRateCents: z.int().min(0).max(10_000_000),
  notes: optionalNote(5_000),
  archived: z.boolean().default(false),
  expectedVersion: z.int().min(1).nullable().optional(),
}).strict().superRefine(({ studentId, expectedVersion }, context) => {
  if (Boolean(studentId) !== Boolean(expectedVersion)) {
    context.addIssue({ code: "custom", path: ["expectedVersion"], message: "Version is required only when updating a student." });
  }
});

export const saveTemplateSchema = z.object({
  idempotencyKey,
  templateId: z.uuid().nullable().optional(),
  studentId: z.uuid(),
  weekday: z.int().min(1).max(7),
  startsOn: isoDate,
  endsOn: isoDate.nullable().optional(),
  paused: z.boolean().default(false),
  archived: z.boolean().default(false),
  expectedVersion: z.int().min(1).nullable().optional(),
}).strict().superRefine(({ templateId, expectedVersion, startsOn, endsOn }, context) => {
  if (endsOn != null && endsOn < startsOn) {
    context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after the start date." });
  }
  if (Boolean(templateId) !== Boolean(expectedVersion)) {
    context.addIssue({ code: "custom", path: ["expectedVersion"], message: "Version is required only when updating a template." });
  }
});

export const saveSessionSchema = z.object({
  idempotencyKey,
  sessionId: z.uuid().nullable().optional(),
  studentId: z.uuid(),
  sessionDate: isoDate,
  status: z.enum(["scheduled", "held", "canceled", "no_show"]),
  void: z.boolean().default(false),
  voidReason: z.string().trim().min(1).max(500).nullable().optional(),
  expectedVersion: z.int().min(1).nullable().optional(),
}).strict().superRefine(({ sessionId, expectedVersion, void: shouldVoid, voidReason }, context) => {
  if (Boolean(sessionId) !== Boolean(expectedVersion)) {
    context.addIssue({ code: "custom", path: ["expectedVersion"], message: "Version is required only when updating a session." });
  }
  if (shouldVoid && !sessionId) {
    context.addIssue({ code: "custom", path: ["void"], message: "A new session cannot be removed before it is created." });
  }
  if (shouldVoid && !voidReason) {
    context.addIssue({ code: "custom", path: ["voidReason"], message: "A reason is required when removing a session." });
  }
  if (!shouldVoid && voidReason) {
    context.addIssue({ code: "custom", path: ["voidReason"], message: "A removal reason is only valid when removing a session." });
  }
});

const replacementPaymentSchema = z.object({
  paymentDate: isoDate,
  amountCents: z.int().positive().max(100_000_000),
  method: z.enum(["cash", "transfer", "other"]),
  notes: optionalNote(1_000),
}).strict();

export const correctPaymentSchema = z.object({
  idempotencyKey,
  paymentId: z.uuid(),
  expectedVersion: z.int().min(1),
  voidReason: z.string().trim().min(1).max(500),
  replacement: replacementPaymentSchema.nullable().optional(),
}).strict();

export const markDailyReviewedSchema = z.object({
  idempotencyKey,
  reviewDate: isoDate,
}).strict();
