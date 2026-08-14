import "server-only";

import {
  balanceState,
  isOverdue,
  periodSummary,
  studentBalanceCents,
} from "@/lib/domain/ledger";
import { requireUser } from "@/lib/supabase/server";
import type {
  Json,
  PaymentRow,
  SessionRow,
  StudentRow,
} from "@/lib/supabase/database.types";
import type {
  LedgerAuditEvent,
  LedgerDailyReview,
  LedgerDashboard,
  LedgerPayment,
  LedgerSession,
  LedgerStudent,
  LedgerTemplate,
  LoadLedgerDashboardOptions,
} from "./types";

type TemplateRow = {
  id: string;
  owner_id: string;
  student_id: string;
  weekday: number;
  starts_on: string;
  ends_on: string | null;
  paused_at: string | null;
  archived_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type AuditEventRow = {
  id: string;
  owner_id: string;
  operation_id: string;
  entity_type: LedgerAuditEvent["entityType"];
  entity_id: string;
  action: string;
  before_state: Json | null;
  after_state: Json | null;
  entity_version: number | null;
  occurred_at: string;
};

type DailyReviewRow = {
  id: string;
  owner_id: string;
  review_date: string;
  reviewed_at: string;
  version: number;
  created_operation_id: string;
};

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_AUDIT_LIMIT = 100;

export class LedgerReadError extends Error {
  constructor() {
    super("The ledger could not be loaded. Please retry.");
    this.name = "LedgerReadError";
  }
}

function assertIsoDate(value: string, label: string) {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be an ISO date`);
  }
  return value;
}

function barbadosToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Barbados",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function mapStudent(row: StudentRow): LedgerStudent {
  return {
    id: row.id,
    name: row.name,
    defaultRateCents: row.default_rate_cents,
    notes: row.notes,
    archivedAt: row.archived_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSession(row: SessionRow): LedgerSession {
  return {
    id: row.id,
    studentId: row.student_id,
    templateId: row.template_id,
    sessionDate: row.session_date,
    status: row.status,
    chargeRateCents: row.charge_rate_cents,
    occurrenceNumber: row.occurrence_number,
    source: row.source,
    manuallyEditedAt: row.manually_edited_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdOperationId: row.created_operation_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row: PaymentRow): LedgerPayment {
  return {
    id: row.id,
    studentId: row.student_id,
    paymentDate: row.payment_date,
    amountCents: row.amount_cents,
    method: row.method,
    notes: row.notes,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    replacementPaymentId: row.replacement_payment_id,
    createdOperationId: row.created_operation_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attendanceFor(sessions: readonly LedgerSession[], startDate: string, endDate: string) {
  const counts = { scheduled: 0, held: 0, canceled: 0, no_show: 0 };
  for (const session of sessions) {
    if (!session.voidedAt && session.sessionDate >= startDate && session.sessionDate <= endDate) {
      counts[session.status] += 1;
    }
  }
  return counts;
}

function unwrap<T>(result: QueryResult<T>): T[] {
  if (result.error) throw new LedgerReadError();
  return result.data ?? [];
}

export async function loadLedgerDashboard(
  options: LoadLedgerDashboardOptions = {},
): Promise<LedgerDashboard> {
  const { supabase, user } = await requireUser();
  const today = assertIsoDate(options.today ?? barbadosToday(), "today");
  const periodStart = assertIsoDate(options.periodStart ?? `${today.slice(0, 7)}-01`, "periodStart");
  const periodEnd = assertIsoDate(options.periodEnd ?? today, "periodEnd");
  if (periodStart > periodEnd) throw new Error("periodStart must not be after periodEnd");
  const auditLimit = Math.min(Math.max(options.auditLimit ?? DEFAULT_AUDIT_LIMIT, 1), 500);

  const [studentsResult, sessionsResult, paymentsResult, templatesResult, auditResult, reviewsResult] =
    await Promise.all([
      supabase.from("students").select("*").eq("owner_id", user.id).order("name"),
      supabase.from("sessions").select("*").eq("owner_id", user.id).order("session_date", { ascending: false }),
      supabase.from("payments").select("*").eq("owner_id", user.id).order("payment_date", { ascending: false }),
      supabase.from("recurring_session_templates").select("*").eq("owner_id", user.id).order("starts_on"),
      supabase.from("audit_events").select("*").eq("owner_id", user.id).order("occurred_at", { ascending: false }).limit(auditLimit),
      supabase.from("daily_reviews").select("*").eq("owner_id", user.id).order("review_date", { ascending: false }),
    ]);

  const studentRows = unwrap(studentsResult as QueryResult<StudentRow>);
  const sessionRows = unwrap(sessionsResult as QueryResult<SessionRow>);
  const paymentRows = unwrap(paymentsResult as QueryResult<PaymentRow>);
  const templateRows = unwrap(templatesResult as unknown as QueryResult<TemplateRow>);
  const auditRows = unwrap(auditResult as unknown as QueryResult<AuditEventRow>);
  const reviewRows = unwrap(reviewsResult as unknown as QueryResult<DailyReviewRow>);

  const students = studentRows.map(mapStudent);
  const sessions = sessionRows.map(mapSession);
  const payments = paymentRows.map(mapPayment);
  const templates: LedgerTemplate[] = templateRows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    weekday: row.weekday,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    pausedAt: row.paused_at,
    archivedAt: row.archived_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const auditEvents: LedgerAuditEvent[] = auditRows.map((row) => ({
    id: row.id,
    operationId: row.operation_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    beforeState: row.before_state,
    afterState: row.after_state,
    entityVersion: row.entity_version,
    occurredAt: row.occurred_at,
  }));
  const dailyReviews: LedgerDailyReview[] = reviewRows.map((row) => ({
    id: row.id,
    reviewDate: row.review_date,
    reviewedAt: row.reviewed_at,
    version: row.version,
    createdOperationId: row.created_operation_id,
  }));

  const studentSummaries = students.map((student) => {
    const studentSessions = sessionRows.filter((row) => row.student_id === student.id);
    const studentPayments = paymentRows.filter((row) => row.student_id === student.id);
    const balanceCents = studentBalanceCents(studentSessions, studentPayments);
    const overdue = isOverdue(studentSessions, studentPayments, today);
    const lastHeld = studentSessions.find((row) =>
      !row.voided_at && row.status === "held" && row.session_date <= today);
    const todaySession = sessions.find((row) =>
      row.studentId === student.id && row.sessionDate === today && !row.voidedAt) ?? null;
    return {
      ...student,
      balanceCents,
      balanceState: balanceState(balanceCents, overdue),
      overdue,
      lastHeldOn: lastHeld?.session_date ?? null,
      todaySession,
    };
  });

  const domainPeriod = periodSummary(sessionRows, paymentRows, periodStart, periodEnd);
  const todayPayments = payments.filter((row) => !row.voidedAt && row.paymentDate === today);
  const reviewedToday = dailyReviews.find((review) => review.reviewDate === today);

  return {
    user: { id: user.id, email: user.email ?? null },
    today,
    students,
    studentSummaries,
    sessions,
    payments,
    templates,
    auditEvents,
    dailyReviews,
    period: {
      startDate: periodStart,
      endDate: periodEnd,
      collectedCents: domainPeriod.collectedCents,
      totalOwedCents: domainPeriod.totalOwedCents,
      totalCreditCents: domainPeriod.totalCreditCents,
      attendance: attendanceFor(sessions, periodStart, periodEnd),
    },
    dayRecap: {
      date: today,
      collectedCents: todayPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
      attendance: attendanceFor(sessions, today, today),
      reviewedAt: reviewedToday?.reviewedAt ?? null,
      overdueStudentCount: studentSummaries.filter((student) => student.overdue && !student.archivedAt).length,
    },
  };
}
