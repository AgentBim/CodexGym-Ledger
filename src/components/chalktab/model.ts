import { formatMoney, type PackageDefinition, type StudentPackage } from "@/lib/domain/packages";
import type { UiSnapshot } from "@/lib/ledger/ui-types";
export type AttendanceMark = "present" | "late" | "absent";
export type PaymentMethod = "cash" | "transfer" | "other";
export type BalanceState = "overdue" | "owes" | "settled" | "credit";

export type Student = {
  id: string;
  version: number;
  name: string;
  status: "active" | "archived";
  memberSince: string;
  rateCents: number;
  /** Positive = owes, negative = credit. */
  balanceCents: number;
  /** Owes for sessions before today. Cleared once the balance is paid down. */
  overdue: boolean;
  enrolled: boolean;
  scheduledToday: boolean;
  notes: string;
};

export type EventKind = "payment" | "attendance" | "student" | "schedule" | "void" | "package" | "adjustment";
export type ActivityEvent = { id: string; kind: EventKind; title: string; studentId?: string; subject: string; detail: string; date: string; time: string; actor: string };

export type ClassSummary = { present: number; late: number; absent: number; unmarked: number; collectedCents: number; outstandingCents: number; outstandingStudents: number; packagesUsed: number };
export type ClassSession = {
  title: string;
  date: string;
  start: string;
  end: string;
  status: "upcoming" | "recorded";
  marks: Record<string, AttendanceMark>;
  summary?: ClassSummary;
};

export type Payment = { id: string; studentId: string; date: string; amountCents: number; method: PaymentMethod };

export type LedgerState = {
  today: string;
  seq: number;
  schedule: UiSnapshot["schedule"];
  email: string | null;
  students: Student[];
  packages: PackageDefinition[];
  studentPackages: StudentPackage[];
  payments: Payment[];
  events: ActivityEvent[];
  classSession: ClassSession;
};


export type LedgerAction =
  | { type: "mark"; studentId: string; mark: AttendanceMark | null }
  | { type: "completeClass" }
  | { type: "createStudent"; name: string; rateCents: number }
  | { type: "restoreStudent"; studentId: string }
  | { type: "saveSchedule"; title: string; weekday: number; start: string; end: string }
  | { type: "recordPayment"; studentId: string; amountCents: number; date: string; method: PaymentMethod }
  | { type: "adjustBalance"; studentId: string; deltaCents: number; reason: string }
  | { type: "logSession"; studentId: string; date: string; mark: AttendanceMark }
  | { type: "toggleEnrolled"; studentId: string }
  | { type: "archiveStudent"; studentId: string }
  | { type: "updateStudent"; studentId: string; name: string; rateCents: number }
  | { type: "saveNotes"; studentId: string; notes: string }
  | { type: "createPackage"; definition: Omit<PackageDefinition, "id"> }
  | { type: "setPackageArchived"; packageId: string; archived: boolean }
  | { type: "assignPackage"; studentId: string; packageId: string; startDate: string; endDate: string | null };

export function balanceState(student: Pick<Student, "balanceCents" | "overdue">): BalanceState {
  if (student.balanceCents < 0) return "credit";
  if (student.balanceCents === 0) return "settled";
  return student.overdue ? "overdue" : "owes";
}

export function balanceLabel(student: Pick<Student, "balanceCents" | "overdue">) {
  const state = balanceState(student);
  if (state === "credit") return `Credit ${formatMoney(student.balanceCents)}`;
  if (state === "settled") return "Settled";
  return `Owes ${formatMoney(student.balanceCents)}`;
}

export const markLabel: Record<AttendanceMark, string> = { present: "Present", late: "Late", absent: "Absent" };
