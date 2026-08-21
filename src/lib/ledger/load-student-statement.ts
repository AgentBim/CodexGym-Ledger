import "server-only";

import { buildAccountStatementLedger, type AccountStatementEntry } from "@/lib/domain/statement";
import { requireUser } from "@/lib/supabase/server";
import type { PaymentRow, SessionRow, StudentRow } from "@/lib/supabase/database.types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StatementSessionRow = Pick<SessionRow, "id" | "session_date" | "status" | "charge_rate_cents" | "voided_at" | "created_at">;
type StatementPaymentRow = Pick<PaymentRow, "id" | "payment_date" | "amount_cents" | "method" | "voided_at" | "created_at">;
type StatementStudentRow = Pick<StudentRow, "id" | "name" | "archived_at">;

export type StudentAccountStatement = {
  student: { id: string; name: string; archived: boolean };
  from: string;
  to: string;
  generatedOn: string;
  openingBalanceCents: number;
  chargeTotalCents: number;
  paymentTotalCents: number;
  closingBalanceCents: number;
  entries: AccountStatementEntry[];
};

export class StatementNotFoundError extends Error {
  constructor() {
    super("Student not found");
    this.name = "StatementNotFoundError";
  }
}

export class StatementReadError extends Error {
  constructor() {
    super("The account statement could not be loaded. Please retry.");
    this.name = "StatementReadError";
  }
}

function validDate(value: string | undefined) {
  if (!value || !ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function barbadosToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Barbados",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function loadStudentStatement({
  studentId,
  from,
  to,
}: {
  studentId: string;
  from?: string;
  to?: string;
}): Promise<StudentAccountStatement> {
  if (!UUID.test(studentId)) throw new StatementNotFoundError();
  const { supabase, user } = await requireUser();
  const generatedOn = barbadosToday();
  const endDate = validDate(to) ?? generatedOn;

  const [studentResult, sessionsResult, paymentsResult] = await Promise.all([
    supabase.from("students").select("id,name,archived_at").eq("owner_id", user.id).eq("id", studentId).maybeSingle(),
    supabase.from("sessions").select("id,session_date,status,charge_rate_cents,voided_at,created_at").eq("owner_id", user.id).eq("student_id", studentId).lte("session_date", endDate).order("session_date"),
    supabase.from("payments").select("id,payment_date,amount_cents,method,voided_at,created_at").eq("owner_id", user.id).eq("student_id", studentId).lte("payment_date", endDate).order("payment_date"),
  ]);

  if (studentResult.error || sessionsResult.error || paymentsResult.error) throw new StatementReadError();
  if (!studentResult.data) throw new StatementNotFoundError();

  const student = studentResult.data as StatementStudentRow;
  const sessions = (sessionsResult.data ?? []) as StatementSessionRow[];
  const payments = (paymentsResult.data ?? []) as StatementPaymentRow[];
  const earliestDate = [
    ...sessions.filter((entry) => !entry.voided_at && entry.status === "held" && entry.charge_rate_cents !== null).map((entry) => entry.session_date),
    ...payments.filter((entry) => !entry.voided_at).map((entry) => entry.payment_date),
  ].sort()[0] ?? endDate;
  const requestedStart = validDate(from);
  const startDate = requestedStart && requestedStart <= endDate ? requestedStart : earliestDate;
  const ledger = buildAccountStatementLedger({ from: startDate, to: endDate, sessions, payments });

  return {
    student: { id: student.id, name: student.name, archived: Boolean(student.archived_at) },
    from: startDate,
    to: endDate,
    generatedOn,
    ...ledger,
  };
}
