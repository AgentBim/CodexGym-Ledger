import type { PaymentMethod, SessionStatus } from "@/lib/supabase/database.types";
import type { Adjustment } from "@/lib/ledger/ui-types";

type StatementSession = {
  id: string;
  session_date: string;
  status: SessionStatus;
  charge_rate_cents: number | null;
  voided_at: string | null;
  created_at: string;
};

type StatementPayment = {
  id: string;
  payment_date: string;
  amount_cents: number;
  method: PaymentMethod;
  voided_at: string | null;
  created_at: string;
};

export type AccountStatementEntry = {
  id: string;
  kind: "session" | "payment" | "adjustment";
  date: string;
  description: string;
  debitCents: number;
  creditCents: number;
  runningBalanceCents: number;
};

export type AccountStatementLedger = {
  openingBalanceCents: number;
  chargeTotalCents: number;
  paymentTotalCents: number;
  closingBalanceCents: number;
  entries: AccountStatementEntry[];
};

const methodLabel: Record<PaymentMethod, string> = {
  cash: "Cash payment",
  transfer: "Transfer payment",
  other: "Payment",
};

export function buildAccountStatementLedger({
  from,
  to,
  sessions,
  payments,
  adjustments = [],
}: {
  from: string;
  to: string;
  sessions: readonly StatementSession[];
  payments: readonly StatementPayment[];
  adjustments?: readonly Adjustment[];
}): AccountStatementLedger {
  if (from > to) throw new Error("Statement start date must not be after end date");

  const activeCharges = sessions.filter((entry) =>
    !entry.voided_at && entry.status === "held" && entry.charge_rate_cents !== null && entry.session_date <= to);
  const activePayments = payments.filter((entry) => !entry.voided_at && entry.payment_date <= to);
  const openingBalanceCents =
    activeCharges.reduce((sum, entry) => sum + (entry.session_date < from ? entry.charge_rate_cents ?? 0 : 0), 0) -
    activePayments.reduce((sum, entry) => sum + (entry.payment_date < from ? entry.amount_cents : 0), 0) +
    adjustments.filter(e => e.entry_date < from).reduce((sum,e) => sum+e.amount_cents,0);

  const periodEntries = [
    ...adjustments.filter(e => e.entry_date >= from && e.entry_date <= to).map(e => ({ id: e.id, kind: "adjustment" as const, date: e.entry_date, createdAt: e.created_at, description: e.reason, debitCents: Math.max(0,e.amount_cents), creditCents: Math.max(0,-e.amount_cents) })),
    ...activeCharges.filter((entry) => entry.session_date >= from).map((entry) => ({
      id: entry.id,
      kind: "session" as const,
      date: entry.session_date,
      createdAt: entry.created_at,
      description: "Held session",
      debitCents: entry.charge_rate_cents ?? 0,
      creditCents: 0,
    })),
    ...activePayments.filter((entry) => entry.payment_date >= from).map((entry) => ({
      id: entry.id,
      kind: "payment" as const,
      date: entry.payment_date,
      createdAt: entry.created_at,
      description: methodLabel[entry.method],
      debitCents: 0,
      creditCents: entry.amount_cents,
    })),
  ].sort((left, right) =>
    left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));

  let runningBalanceCents = openingBalanceCents;
  const entries: AccountStatementEntry[] = periodEntries.map((entry) => {
    runningBalanceCents += entry.debitCents - entry.creditCents;
    return {
      id: entry.id,
      kind: entry.kind,
      date: entry.date,
      description: entry.description,
      debitCents: entry.debitCents,
      creditCents: entry.creditCents,
      runningBalanceCents,
    };
  });
  const chargeTotalCents = entries.reduce((sum, entry) => sum + entry.debitCents, 0);
  const paymentTotalCents = entries.reduce((sum, entry) => sum + entry.creditCents, 0);

  return {
    openingBalanceCents,
    chargeTotalCents,
    paymentTotalCents,
    closingBalanceCents: openingBalanceCents + chargeTotalCents - paymentTotalCents,
    entries,
  };
}
