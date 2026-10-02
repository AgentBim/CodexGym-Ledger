import type { LedgerDashboard } from "./types";
import type { Adjustment } from "./ui-types";

export function withAdjustments(d: LedgerDashboard, adjustments: Adjustment[]): LedgerDashboard {
  const studentSummaries = d.studentSummaries.map(s => {
    const entries = adjustments.filter(a => a.student_id === s.id);
    const balanceCents = s.balanceCents + entries.reduce((n,a) => n+a.amount_cents,0);
    const priorCharges=d.sessions.filter(e=>e.studentId===s.id && !e.voidedAt && e.status==="held" && e.sessionDate<d.today).reduce((n,e)=>n+(e.chargeRateCents??0),0);
    const paid=d.payments.filter(e=>e.studentId===s.id && !e.voidedAt).reduce((n,e)=>n+e.amountCents,0);
    const priorAdjustments=entries.filter(e=>e.amount_cents<0 || e.entry_date<d.today).reduce((n,e)=>n+e.amount_cents,0);
    const overdue = balanceCents > 0 && priorCharges+priorAdjustments-paid>0;
    return { ...s, balanceCents, overdue, balanceState: balanceCents < 0 ? "credit" as const : balanceCents === 0 ? "settled" as const : overdue ? "overdue" as const : "owed" as const };
  });
  const balances=d.students.map(s=>d.sessions.filter(e=>e.studentId===s.id && !e.voidedAt && e.status==="held" && e.sessionDate<=d.period.endDate).reduce((n,e)=>n+(e.chargeRateCents??0),0)
    -d.payments.filter(e=>e.studentId===s.id && !e.voidedAt && e.paymentDate<=d.period.endDate).reduce((n,e)=>n+e.amountCents,0)
    +adjustments.filter(e=>e.student_id===s.id && e.entry_date<=d.period.endDate).reduce((n,e)=>n+e.amount_cents,0));
  return { ...d, studentSummaries, period: { ...d.period,
    totalOwedCents: balances.reduce((n,b) => n+Math.max(0,b),0),
    totalCreditCents: balances.reduce((n,b) => n+Math.max(0,-b),0) },
    dayRecap: { ...d.dayRecap, overdueStudentCount: studentSummaries.filter(s => s.overdue && !s.archivedAt).length } };
}
