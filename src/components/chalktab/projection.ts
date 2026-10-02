import { barbadosTime, barbadosToday, weekday } from "@/lib/domain/calendar";
import { formatMoney } from "@/lib/domain/packages";
import type { LedgerDashboard } from "@/lib/ledger/types";
import type { UiSnapshot } from "@/lib/ledger/ui-types";
import type { ActivityEvent, AttendanceMark, EventKind, LedgerState } from "./model";

export type UiLedgerData = { dashboard: LedgerDashboard; extra: UiSnapshot };

export function projectUi({ dashboard: d, extra: x }: UiLedgerData): LedgerState {
  const marks: Record<string, AttendanceMark> = {};
  for (const s of d.sessions.filter(s => s.sessionDate === d.today && !s.voidedAt && s.occurrenceNumber === 1)) {
    if (s.status === "held") marks[s.studentId] = x.attendance.find(a => a.id === s.id)?.mark === "late" ? "late" : "present";
    if (s.status === "no_show") marks[s.studentId] = "absent";
  }
  const students = d.studentSummaries.map(s => ({
    id: s.id, version: s.version, name: s.name, status: s.archivedAt ? "archived" as const : "active" as const,
    memberSince: s.createdAt.slice(0, 10), rateCents: s.defaultRateCents, balanceCents: s.balanceCents,
    overdue: s.overdue, notes: s.notes ?? "",
    enrolled: x.enrollments.find(e => e.id === s.id)?.enrolled ?? d.templates.some(t => t.studentId === s.id && !t.archivedAt && !t.pausedAt && (!t.endsOn || t.endsOn >= d.today)),
    scheduledToday: s.todaySession?.status !== "canceled" && (Boolean(s.todaySession) || (x.enrollments.find(e => e.id === s.id)?.enrolled === true && (!x.schedule || x.schedule.weekday===weekday(d.today))) || (x.enrollments.find(e => e.id === s.id)?.enrolled == null && d.templates.some(t => t.studentId === s.id && !t.archivedAt && !t.pausedAt && t.startsOn<=d.today && (!t.endsOn || t.endsOn>=d.today) && t.weekday%7===weekday(d.today)))),
  }));
  const kinds: Record<string, EventKind> = { session: "attendance", payment: "payment", template: "schedule", class_settings: "schedule", student: "student", package: "package", adjustment: "adjustment", daily_review: "schedule" };
  const events: ActivityEvent[] = d.auditEvents.map(e => {
    const row = (e.afterState ?? e.beforeState ?? {}) as Record<string, unknown>;
    const studentId = e.entityType === "student" ? e.entityId : typeof row.student_id === "string" ? row.student_id : undefined;
    return { id: e.id, kind: e.action.includes("void") ? "void" : kinds[e.entityType] ?? "student", title: e.action.replaceAll("_", " "), studentId,
      subject: students.find(s => s.id === studentId)?.name ?? (typeof row.name === "string" ? row.name : "Class ledger"),
      detail: typeof row.amount_cents === "number" ? `${row.amount_cents<0?"Credit ":""}${formatMoney(row.amount_cents)} · ${row.reason ?? row.method ?? "Adjustment"}` : typeof row.status === "string" ? `${row.attendance_mark ?? row.status}${typeof row.charge_rate_cents==="number" ? ` · ${formatMoney(row.charge_rate_cents)} charged` : ""}` : typeof row.name === "string" ? row.name : e.entityType.replaceAll("_", " "),
      date: barbadosToday(new Date(e.occurredAt)), time: barbadosTime(new Date(e.occurredAt)), actor: "Coach" };
  });
  const roster = students.filter(s => s.scheduledToday && s.status === "active");
  const owing = roster.filter(s => s.balanceCents > 0);
  const counts = { present: 0, late: 0, absent: 0 };
  for (const s of roster) if (marks[s.id]) counts[marks[s.id]!]++;
  const marked = Object.keys(marks).length;
  return { today: d.today, seq: 0, email: d.user.email, schedule: x.schedule, students, packages: x.packages, studentPackages: x.studentPackages,
    payments: d.payments.filter(p => !p.voidedAt).map(p => ({ id: p.id, studentId: p.studentId, date: p.paymentDate, amountCents: p.amountCents, method: p.method })), events,
    classSession: { title: x.schedule?.title ?? "Class register", date: d.today, start: x.schedule?.start ?? "", end: x.schedule?.end ?? "", status: roster.length > 0 && roster.every(s => marks[s.id]) ? "recorded" : "upcoming", marks,
      summary: marked ? { ...counts, unmarked: roster.filter(s => !marks[s.id]).length, collectedCents: d.dayRecap.collectedCents, outstandingCents: owing.reduce((n,s) => n+s.balanceCents,0), outstandingStudents: owing.length, packagesUsed: d.sessions.filter(s => s.sessionDate === d.today && !s.voidedAt && x.attendance.some(a => a.id===s.id && a.packageId)).length } : undefined }
  };
}
