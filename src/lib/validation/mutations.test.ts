import { describe, expect, it } from "vitest";
import {
  correctPaymentSchema,
  saveSessionSchema,
  saveStudentSchema,
  saveTemplateSchema,
} from "./mutations";

const operationId = "39d73766-f18c-4f85-9e23-822669b81831";
const entityId = "6989d31c-2a11-4749-843c-20d616bae44d";

describe("mutation validation", () => {
  it("normalizes a new student and defaults it to active", () => {
    expect(saveStudentSchema.parse({
      idempotencyKey: operationId,
      name: "  Alex  ",
      defaultRateCents: 3_000,
    })).toMatchObject({ name: "Alex", archived: false });
  });

  it("normalizes blank notes to null for stable idempotency", () => {
    expect(saveStudentSchema.parse({
      idempotencyKey: operationId,
      name: "Alex",
      defaultRateCents: 3_000,
      notes: "   ",
    }).notes).toBeNull();
  });

  it("rejects a recurring template whose end precedes its start", () => {
    expect(() => saveTemplateSchema.parse({
      idempotencyKey: operationId,
      studentId: entityId,
      weekday: 5,
      startsOn: "2026-08-14",
      endsOn: "2026-08-07",
    })).toThrow(/End date/);
  });

  it("requires a reason before voiding a session", () => {
    expect(() => saveSessionSchema.parse({
      idempotencyKey: operationId,
      sessionId: entityId,
      studentId: entityId,
      sessionDate: "2026-08-04",
      status: "held",
      void: true,
      expectedVersion: 1,
    })).toThrow(/reason/i);
  });

  it("accepts an atomic payment correction with a complete replacement", () => {
    expect(correctPaymentSchema.parse({
      idempotencyKey: operationId,
      paymentId: entityId,
      expectedVersion: 2,
      voidReason: "Wrong amount",
      replacement: {
        paymentDate: "2026-08-04",
        amountCents: 3_000,
        method: "transfer",
      },
    }).replacement).toMatchObject({ amountCents: 3_000, method: "transfer" });
  });
});
