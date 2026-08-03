import { describe, expect, it } from "vitest";
import { paymentInputSchema, studentInputSchema } from "./domain";

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
});
