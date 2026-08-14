import type { AdultAdminReadModel } from "@/components/adult-admin-app";
import type { LedgerDashboard } from "./types";

const weekdays = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function dateLabel(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-BB", { ...options, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function toAdultAdminReadModel(dashboard: LedgerDashboard): AdultAdminReadModel {
  const names = new Map(dashboard.students.map((student) => [student.id, student.name]));
  const sessionEntry = (session: LedgerDashboard["sessions"][number]) => ({
    id: session.id,
    kind: "session" as const,
    studentId: session.studentId,
    studentName: names.get(session.studentId) ?? "Archived student",
    date: session.sessionDate,
    dateLabel: dateLabel(session.sessionDate, { day: "numeric", month: "short", year: "numeric" }),
    label: session.status === "no_show" ? "No-show session" : `${session.status[0]!.toUpperCase()}${session.status.slice(1)} session`,
    detail: session.status === "held" && session.chargeRateCents != null ? `BBD $${(session.chargeRateCents / 100).toFixed(2)} charge` : "No charge",
    voided: Boolean(session.voidedAt),
    voidReason: session.voidReason,
    version: session.version,
    status: session.status,
    chargeRateCents: session.chargeRateCents,
    sortKey: `${session.sessionDate}-${session.createdAt}`,
  });
  const paymentEntry = (payment: LedgerDashboard["payments"][number]) => ({
    id: payment.id,
    kind: "payment" as const,
    studentId: payment.studentId,
    studentName: names.get(payment.studentId) ?? "Archived student",
    date: payment.paymentDate,
    dateLabel: dateLabel(payment.paymentDate, { day: "numeric", month: "short", year: "numeric" }),
    label: `BBD $${(payment.amountCents / 100).toFixed(2)} payment`,
    detail: `${payment.method[0]!.toUpperCase()}${payment.method.slice(1)}`,
    voided: Boolean(payment.voidedAt),
    voidReason: payment.voidReason,
    version: payment.version,
    amountCents: payment.amountCents,
    method: payment.method,
    notes: payment.notes,
    replacementPaymentId: payment.replacementPaymentId,
    sortKey: `${payment.paymentDate}-${payment.createdAt}`,
  });
  return {
    todayDate: dashboard.today,
    todayLabel: dateLabel(dashboard.today, { weekday: "long", day: "numeric", month: "long" }),
    students: dashboard.studentSummaries.map((student) => ({
      id: student.id,
      name: student.name,
      balanceCents: student.balanceCents,
      balanceState: student.balanceState,
      todaySessionStatus: student.todaySession?.status ?? null,
      lastAttendedOn: student.lastHeldOn ? dateLabel(student.lastHeldOn, { day: "numeric", month: "short" }) : null,
      defaultRateCents: student.defaultRateCents,
      notes: student.notes,
      version: student.version,
      archived: Boolean(student.archivedAt),
      history: [
        ...dashboard.sessions.filter((session) => session.studentId === student.id).map(sessionEntry),
        ...dashboard.payments.filter((payment) => payment.studentId === student.id).map(paymentEntry),
      ].sort((a, b) => b.sortKey.localeCompare(a.sortKey)),
    })),
    activities: dashboard.auditEvents.map((event) => ({
      id: event.id,
      label: `${event.entityType.replaceAll("_", " ")} · ${event.action.replaceAll("_", " ")}`,
      occurredAtLabel: new Intl.DateTimeFormat("en-BB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Barbados" }).format(new Date(event.occurredAt)),
    })),
    dailyEntries: [
      ...dashboard.sessions.filter((session) => !session.voidedAt && session.sessionDate === dashboard.today).map((session) => ({
        id: session.id,
        kind: "session" as const,
        studentName: names.get(session.studentId) ?? "Archived student",
        label: session.status === "no_show" ? "No-show" : `${session.status[0]!.toUpperCase()}${session.status.slice(1)}`,
        detail: session.status === "held" && session.chargeRateCents != null ? `BBD $${(session.chargeRateCents / 100).toFixed(2)} charge` : "No charge",
        entry: sessionEntry(session),
      })),
      ...dashboard.payments.filter((payment) => !payment.voidedAt && payment.paymentDate === dashboard.today).map((payment) => ({
        id: payment.id,
        kind: "payment" as const,
        studentName: names.get(payment.studentId) ?? "Archived student",
        label: `BBD $${(payment.amountCents / 100).toFixed(2)} payment`,
        detail: `${payment.method[0]!.toUpperCase()}${payment.method.slice(1)}`,
        entry: paymentEntry(payment),
      })),
    ],
    templates: dashboard.templates.filter((template) => !template.archivedAt).map((template) => {
      const next = dashboard.sessions.filter((session) => !session.voidedAt && session.templateId === template.id && session.sessionDate >= dashboard.today).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))[0];
      return {
        id: template.id,
        studentId: template.studentId,
        studentName: names.get(template.studentId) ?? "Archived student",
        weekday: template.weekday,
        weekdayLabel: weekdays[template.weekday] ?? "Weekly",
        startsOn: template.startsOn,
        endsOn: template.endsOn,
        nextSessionOn: next ? dateLabel(next.sessionDate, { day: "numeric", month: "short" }) : null,
        paused: Boolean(template.pausedAt),
        version: template.version,
      };
    }),
    review: {
      date: dashboard.dayRecap.date,
      reviewed: Boolean(dashboard.dayRecap.reviewedAt),
      heldCount: dashboard.dayRecap.attendance.held,
      noShowCount: dashboard.dayRecap.attendance.no_show,
      collectedCents: dashboard.dayRecap.collectedCents,
      scheduledCount: dashboard.dayRecap.attendance.scheduled,
    },
    period: {
      label: `${dateLabel(dashboard.period.startDate, { month: "long", year: "numeric" })} summary`,
      totalOwedCents: dashboard.period.totalOwedCents,
      totalCreditCents: dashboard.period.totalCreditCents,
      attendanceCount: dashboard.period.attendance.held,
      collectedCents: dashboard.period.collectedCents,
    },
  };
}
