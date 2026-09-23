import { describe, expect, it } from "vitest";
import { isOverdue, periodSummary, studentBalanceCents } from "./ledger";

const session = (overrides = {}) => ({ student_id: "a", session_date: "2026-07-30", status: "held" as const, charge_rate_cents: 3000, voided_at: null, ...overrides });
const pkg = (overrides = {}) => ({ student_id: "a", purchased_on: "2026-07-01", price_cents: 30000, voided_at: null, ...overrides });
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
  it("charges package purchases while package-covered sessions add nothing", () => {
    const covered = session({ charge_rate_cents: 0 });
    expect(studentBalanceCents([covered, covered], [payment({ amount_cents: 60000 })], [pkg()])).toBe(-30000);
    expect(studentBalanceCents([], [], [pkg({ voided_at: "2026-07-02T00:00:00Z" })])).toBe(0);
  });
  it("treats an unpaid package bought before today as overdue", () => {
    expect(isOverdue([], [], "2026-07-31", [pkg()])).toBe(true);
    expect(isOverdue([], [], "2026-07-01", [pkg()])).toBe(false);
  });
  it("includes packages purchased by the period end in owed totals", () => {
    expect(periodSummary([], [], "2026-07-01", "2026-07-31", [pkg(), pkg({ student_id: "b", purchased_on: "2026-08-02" })])).toMatchObject({ totalOwedCents: 30000 });
  });
});
