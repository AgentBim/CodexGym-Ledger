import { describe, expect, it } from "vitest";
import { buildAccountStatementLedger } from "./statement";

const sessions = [
  { id: "s-old", session_date: "2026-01-10", status: "held" as const, charge_rate_cents: 3000, voided_at: null, created_at: "2026-01-10T12:00:00Z" },
  { id: "s-period", session_date: "2026-02-05", status: "held" as const, charge_rate_cents: 3000, voided_at: null, created_at: "2026-02-05T12:00:00Z" },
  { id: "s-scheduled", session_date: "2026-02-06", status: "scheduled" as const, charge_rate_cents: null, voided_at: null, created_at: "2026-02-06T12:00:00Z" },
  { id: "s-void", session_date: "2026-02-07", status: "held" as const, charge_rate_cents: 3000, voided_at: "2026-02-08T10:00:00Z", created_at: "2026-02-07T12:00:00Z" },
];

const payments = [
  { id: "p-old", payment_date: "2026-01-20", amount_cents: 1000, method: "cash" as const, voided_at: null, created_at: "2026-01-20T12:00:00Z" },
  { id: "p-period", payment_date: "2026-02-05", amount_cents: 2500, method: "transfer" as const, voided_at: null, created_at: "2026-02-05T13:00:00Z" },
  { id: "p-void", payment_date: "2026-02-08", amount_cents: 5000, method: "other" as const, voided_at: "2026-02-09T10:00:00Z", created_at: "2026-02-08T12:00:00Z" },
];

describe("buildAccountStatementLedger", () => {
  it("carries prior account activity into an opening balance", () => {
    const statement = buildAccountStatementLedger({ from: "2026-02-01", to: "2026-02-28", sessions, payments });
    expect(statement.openingBalanceCents).toBe(2000);
    expect(statement.chargeTotalCents).toBe(3000);
    expect(statement.paymentTotalCents).toBe(2500);
    expect(statement.closingBalanceCents).toBe(2500);
  });

  it("excludes voided and non-held entries from client totals", () => {
    const statement = buildAccountStatementLedger({ from: "2026-02-01", to: "2026-02-28", sessions, payments });
    expect(statement.entries.map((entry) => entry.id)).toEqual(["s-period", "p-period"]);
  });

  it("orders same-day activity deterministically and calculates running balances", () => {
    const statement = buildAccountStatementLedger({ from: "2026-02-01", to: "2026-02-28", sessions, payments });
    expect(statement.entries.map((entry) => entry.description)).toEqual(["Held session", "Transfer payment"]);
    expect(statement.entries.map((entry) => entry.runningBalanceCents)).toEqual([5000, 2500]);
  });

  it("rejects an inverted statement period", () => {
    expect(() => buildAccountStatementLedger({ from: "2026-03-01", to: "2026-02-01", sessions, payments })).toThrow(/start date/i);
  });
});
