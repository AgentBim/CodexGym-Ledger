import type {
  Json,
  PaymentMethod,
  SessionStatus,
} from "@/lib/supabase/database.types";
import type { BalanceState } from "@/lib/domain/ledger";

export type LedgerStudent = {
  id: string;
  name: string;
  defaultRateCents: number;
  notes: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type LedgerSession = {
  id: string;
  studentId: string;
  templateId: string | null;
  sessionDate: string;
  status: SessionStatus;
  chargeRateCents: number | null;
  occurrenceNumber: number;
  source: "manual" | "bulk_attendance" | "recurrence";
  manuallyEditedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdOperationId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type LedgerPayment = {
  id: string;
  studentId: string;
  paymentDate: string;
  amountCents: number;
  method: PaymentMethod;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  replacementPaymentId: string | null;
  createdOperationId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type LedgerTemplate = {
  id: string;
  studentId: string;
  weekday: number;
  startsOn: string;
  endsOn: string | null;
  pausedAt: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type LedgerAuditEvent = {
  id: string;
  operationId: string;
  entityType: "student" | "session" | "payment" | "template" | "daily_review";
  entityId: string;
  action: string;
  beforeState: Json | null;
  afterState: Json | null;
  entityVersion: number | null;
  occurredAt: string;
};

export type LedgerDailyReview = {
  id: string;
  reviewDate: string;
  reviewedAt: string;
  version: number;
  createdOperationId: string;
};

export type StudentLedgerSummary = LedgerStudent & {
  balanceCents: number;
  balanceState: BalanceState;
  overdue: boolean;
  lastHeldOn: string | null;
  todaySession: LedgerSession | null;
};

export type LedgerPeriodSummary = {
  startDate: string;
  endDate: string;
  collectedCents: number;
  totalOwedCents: number;
  totalCreditCents: number;
  attendance: Record<SessionStatus, number>;
};

export type LedgerDayRecap = {
  date: string;
  collectedCents: number;
  attendance: Record<SessionStatus, number>;
  reviewedAt: string | null;
  overdueStudentCount: number;
};

/** JSON-safe data passed from a Server Component to the mobile client shell. */
export type LedgerDashboard = {
  user: { id: string; email: string | null };
  today: string;
  students: LedgerStudent[];
  studentSummaries: StudentLedgerSummary[];
  sessions: LedgerSession[];
  payments: LedgerPayment[];
  templates: LedgerTemplate[];
  auditEvents: LedgerAuditEvent[];
  dailyReviews: LedgerDailyReview[];
  period: LedgerPeriodSummary;
  dayRecap: LedgerDayRecap;
};

export type LoadLedgerDashboardOptions = {
  today?: string;
  periodStart?: string;
  periodEnd?: string;
  auditLimit?: number;
};
