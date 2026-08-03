import { describe, expect, it } from "vitest";
import { isOverdue, periodSummary, studentBalanceCents } from "./ledger";

const session = (overrides = {}) => ({ student_id: "a", session_date: "2026-07-30", status: "held" as const, charge_rate_cents: 3000, voided_at: null, ...overrides });
const payment = (overrides = {}) => ({ student_id: "a", payment_date: "2026-07-30", amount_cents: 3000, voided_at: null, ...overrides });

describe("ledger calculations", () => {
  it("charges held active sessions only", () => {
    expect(studentBalanceCents([session(), session({ status: "scheduled" }), session({ voided_at: "2026-07-31T12:00:00Z" })], [])).toBe(3000);
  });
  it("distinguishes today's debt from overdue debt using oldest-charge-first allocation", () => {
    expect(isOverdue([session()], [], "2026-07-31")).toBe(true);
    expect(isOverdue([session({ session_date: "2026-07-31" })], [], "2026-07-31")).toBe(false);
    expect(isOverdue([session(), session({ session_date: "2026-07-31" })], [payment()], "2026-07-31")).toBe(false);
  });
  it("reports period collection while calculating owed and credit separately as of end", () => {
    expect(periodSummary([session()], [payment({ amount_cents: 5000 })], "2026-07-01", "2026-07-31")).toEqual({ heldCount: 1, collectedCents: 5000, totalOwedCents: 0, totalCreditCents: 2000 });
  });
});
