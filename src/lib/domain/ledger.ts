import type { PaymentRow, SessionRow } from "@/lib/supabase/database.types";

type SessionEntry = Pick<SessionRow, "student_id" | "session_date" | "status" | "charge_rate_cents" | "voided_at">;
type PaymentEntry = Pick<PaymentRow, "student_id" | "payment_date" | "amount_cents" | "voided_at">;

export type BalanceState = "overdue" | "owed" | "settled" | "credit";

export function studentBalanceCents(sessions: readonly SessionEntry[], payments: readonly PaymentEntry[]) {
  const charges = sessions.reduce((sum, row) => sum + (row.status === "held" && !row.voided_at ? row.charge_rate_cents ?? 0 : 0), 0);
  const paid = payments.reduce((sum, row) => sum + (!row.voided_at ? row.amount_cents : 0), 0);
  return charges - paid;
}

export function balanceState(balanceCents: number, hasUnpaidChargeBeforeToday: boolean): BalanceState {
  if (balanceCents < 0) return "credit";
  if (balanceCents === 0) return "settled";
  return hasUnpaidChargeBeforeToday ? "overdue" : "owed";
}

export function isOverdue(sessions: readonly SessionEntry[], payments: readonly PaymentEntry[], barbadosToday: string) {
  const balance = studentBalanceCents(sessions, payments);
  if (balance <= 0) return false;
  const priorCharges = sessions.reduce((sum, row) => sum + (
    row.status === "held" && !row.voided_at && row.session_date < barbadosToday ? row.charge_rate_cents ?? 0 : 0
  ), 0);
  const allPayments = payments.reduce((sum, row) => sum + (!row.voided_at ? row.amount_cents : 0), 0);
  return priorCharges > allPayments;
}

export function periodSummary(
  sessions: readonly SessionEntry[],
  payments: readonly PaymentEntry[],
  startDate: string,
  endDate: string,
) {
  if (startDate > endDate) throw new Error("Invalid period");
  const heldCount = sessions.filter((row) => !row.voided_at && row.status === "held" && row.session_date >= startDate && row.session_date <= endDate).length;
  const collectedCents = payments.reduce((sum, row) => sum + (
    !row.voided_at && row.payment_date >= startDate && row.payment_date <= endDate ? row.amount_cents : 0
  ), 0);
  const studentIds = new Set([...sessions.map((row) => row.student_id), ...payments.map((row) => row.student_id)]);
  let totalOwedCents = 0;
  let totalCreditCents = 0;
  for (const studentId of studentIds) {
    const balance = studentBalanceCents(
      sessions.filter((row) => row.student_id === studentId && row.session_date <= endDate),
      payments.filter((row) => row.student_id === studentId && row.payment_date <= endDate),
    );
    if (balance > 0) totalOwedCents += balance;
    if (balance < 0) totalCreditCents += -balance;
  }
  return { heldCount, collectedCents, totalOwedCents, totalCreditCents };
}
