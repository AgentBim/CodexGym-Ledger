import { describe, expect, it } from "vitest";
import { paymentInputSchema, studentInputSchema } from "./domain";
import { assignPackageSchema, createPackageDefinitionSchema } from "./mutations";

describe("domain validation", () => {
  it("defaults rate and active status", () => {
    expect(studentInputSchema.parse({ name: "  Alex  " })).toMatchObject({
      name: "Alex", defaultRate: 30, status: "active",
    });
  });

  it("rejects negative payments", () => {
    expect(() => paymentInputSchema.parse({
      studentId: "39d73766-f18c-4f85-9e23-822669b81831",
      date: "2026-07-31", amount: -30, method: "cash",
    })).toThrow();
  });
  it("requires a class count only for class packs", () => {
    const base = { idempotencyKey: "39d73766-f18c-4f85-9e23-822669b81831", name: "12-Class Term", priceCents: 30000, validityWeeks: 12 };
    expect(createPackageDefinitionSchema.safeParse({ ...base, kind: "class_pack", classCount: 12 }).success).toBe(true);
    expect(createPackageDefinitionSchema.safeParse({ ...base, kind: "class_pack", classCount: null }).success).toBe(false);
    expect(createPackageDefinitionSchema.safeParse({ ...base, kind: "time_based", classCount: 8 }).success).toBe(false);
  });

  it("rejects package end dates before the start", () => {
    const base = { idempotencyKey: "39d73766-f18c-4f85-9e23-822669b81831", studentId: "39d73766-f18c-4f85-9e23-822669b81832", packageDefinitionId: "39d73766-f18c-4f85-9e23-822669b81833", startsOn: "2026-09-22" };
    expect(assignPackageSchema.safeParse({ ...base, endsOn: "2026-12-15" }).success).toBe(true);
    expect(assignPackageSchema.safeParse({ ...base, endsOn: null }).success).toBe(true);
    expect(assignPackageSchema.safeParse({ ...base, endsOn: "2026-09-21" }).success).toBe(false);
  });
});
