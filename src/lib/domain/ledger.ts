import type { PaymentRow, SessionRow, StudentPackageRow } from "@/lib/supabase/database.types";

type SessionEntry = Pick<SessionRow, "student_id" | "session_date" | "status" | "charge_rate_cents" | "voided_at">;
type PaymentEntry = Pick<PaymentRow, "student_id" | "payment_date" | "amount_cents" | "voided_at">;
/** Package purchases are charges dated by `purchased_on`. Sessions drawn from a package carry a zero charge. */
type PackageEntry = Pick<StudentPackageRow, "student_id" | "purchased_on" | "price_cents" | "voided_at">;

export type BalanceState = "overdue" | "owed" | "settled" | "credit";

const packageCharges = (packages: readonly PackageEntry[], before?: string) =>
  packages.reduce((sum, row) => sum + (!row.voided_at && (before === undefined || row.purchased_on < before) ? row.price_cents : 0), 0);

export function studentBalanceCents(sessions: readonly SessionEntry[], payments: readonly PaymentEntry[], packages: readonly PackageEntry[] = []) {
  const charges = sessions.reduce((sum, row) => sum + (row.status === "held" && !row.voided_at ? row.charge_rate_cents ?? 0 : 0), 0) + packageCharges(packages);
  const paid = payments.reduce((sum, row) => sum + (!row.voided_at ? row.amount_cents : 0), 0);
  return charges - paid;
}

export function balanceState(balanceCents: number, hasUnpaidChargeBeforeToday: boolean): BalanceState {
  if (balanceCents < 0) return "credit";
  if (balanceCents === 0) return "settled";
  return hasUnpaidChargeBeforeToday ? "overdue" : "owed";
}

export function isOverdue(sessions: readonly SessionEntry[], payments: readonly PaymentEntry[], barbadosToday: string, packages: readonly PackageEntry[] = []) {
  const balance = studentBalanceCents(sessions, payments, packages);
  if (balance <= 0) return false;
  const priorCharges = sessions.reduce((sum, row) => sum + (
    row.status === "held" && !row.voided_at && row.session_date < barbadosToday ? row.charge_rate_cents ?? 0 : 0
  ), 0) + packageCharges(packages, barbadosToday);
  const allPayments = payments.reduce((sum, row) => sum + (!row.voided_at ? row.amount_cents : 0), 0);
  return priorCharges > allPayments;
}

export function periodSummary(
  sessions: readonly SessionEntry[],
  payments: readonly PaymentEntry[],
  startDate: string,
  endDate: string,
  packages: readonly PackageEntry[] = [],
) {
  if (startDate > endDate) throw new Error("Invalid period");
  const heldCount = sessions.filter((row) => !row.voided_at && row.status === "held" && row.session_date >= startDate && row.session_date <= endDate).length;
  const collectedCents = payments.reduce((sum, row) => sum + (
    !row.voided_at && row.payment_date >= startDate && row.payment_date <= endDate ? row.amount_cents : 0
  ), 0);
  const studentIds = new Set([...sessions, ...payments, ...packages].map((row) => row.student_id));
  let totalOwedCents = 0;
  let totalCreditCents = 0;
  for (const studentId of studentIds) {
    const balance = studentBalanceCents(
      sessions.filter((row) => row.student_id === studentId && row.session_date <= endDate),
      payments.filter((row) => row.student_id === studentId && row.payment_date <= endDate),
      packages.filter((row) => row.student_id === studentId && row.purchased_on <= endDate),
    );
    if (balance > 0) totalOwedCents += balance;
    if (balance < 0) totalCreditCents += -balance;
  }
  return { heldCount, collectedCents, totalOwedCents, totalCreditCents };
}
