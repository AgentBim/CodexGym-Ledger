import { useReducer } from "react";
import { addDays, barbadosTime, barbadosToday } from "@/lib/domain/calendar";
import { formatMoney, packageEndDate, packageForSession, remainingClasses, type PackageDefinition, type StudentPackage } from "@/lib/domain/packages";

export type AttendanceMark = "present" | "late" | "absent";
export type PaymentMethod = "cash" | "transfer" | "other";
export type BalanceState = "overdue" | "owes" | "settled" | "credit";

export type Student = {
  id: string;
  name: string;
  status: "active" | "archived";
  memberSince: string;
  rateCents: number;
  /** Positive = owes, negative = credit. */
  balanceCents: number;
  /** Owes for sessions before today. Cleared once the balance is paid down. */
  overdue: boolean;
  enrolled: boolean;
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
  students: Student[];
  packages: PackageDefinition[];
  studentPackages: StudentPackage[];
  payments: Payment[];
  events: ActivityEvent[];
  classSession: ClassSession;
};

type Stamp = { date: string; time: string };
export type LedgerAction =
  | { type: "mark"; studentId: string; mark: AttendanceMark | null }
  | { type: "completeClass" }
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

function withBalance(student: Student, deltaCents: number): Student {
  const balanceCents = student.balanceCents + deltaCents;
  return { ...student, balanceCents, overdue: student.overdue && balanceCents > 0 };
}

function updateStudent(state: LedgerState, id: string, update: (s: Student) => Student): LedgerState {
  return { ...state, students: state.students.map((s) => s.id === id ? update(s) : s) };
}

function nameOf(state: LedgerState, id: string) {
  return state.students.find((s) => s.id === id)?.name ?? "Student";
}

function addEvent(state: LedgerState, stamp: Stamp, event: Omit<ActivityEvent, "id" | "date" | "time" | "actor">): LedgerState {
  return { ...state, seq: state.seq + 1, events: [{ ...event, id: `e${state.seq}`, ...stamp, actor: "Coach" }, ...state.events] };
}

/** Draw attended sessions from an active package, otherwise charge the student's rate. */
function applySession(state: LedgerState, studentId: string, date: string, mark: AttendanceMark): { state: LedgerState; detail: string; usedPackage: boolean } {
  if (mark === "absent") return { state, detail: markLabel[mark], usedPackage: false };
  const pkg = packageForSession(state.studentPackages, studentId, date);
  if (pkg) {
    const used = pkg.used + 1;
    const next = { ...state, studentPackages: state.studentPackages.map((p) => p.id === pkg.id ? { ...p, used } : p) };
    return { state: next, detail: `${markLabel[mark]} · ${pkg.name}${pkg.classCount === null ? "" : ` ${used}/${pkg.classCount}`}`, usedPackage: true };
  }
  const rate = state.students.find((s) => s.id === studentId)?.rateCents ?? 0;
  return { state: updateStudent(state, studentId, (s) => withBalance(s, rate)), detail: `${markLabel[mark]} · ${formatMoney(rate)} charged`, usedPackage: false };
}

export function ledgerReducer(state: LedgerState, action: LedgerAction & { stamp: Stamp }): LedgerState {
  const { stamp } = action;
  switch (action.type) {
    case "mark": {
      const marks = { ...state.classSession.marks };
      if (action.mark) marks[action.studentId] = action.mark;
      else delete marks[action.studentId];
      return { ...state, classSession: { ...state.classSession, marks } };
    }
    case "completeClass": {
      const session = state.classSession;
      let next = state;
      let packagesUsed = 0;
      for (const [studentId, mark] of Object.entries(session.marks)) {
        const applied = applySession(next, studentId, session.date, mark);
        packagesUsed += applied.usedPackage ? 1 : 0;
        next = addEvent(applied.state, stamp, { kind: "attendance", title: "Attendance marked", studentId, subject: nameOf(next, studentId), detail: applied.detail });
      }
      const roster = next.students.filter((s) => s.enrolled && s.status === "active");
      const counts = { present: 0, late: 0, absent: 0 };
      for (const mark of Object.values(session.marks)) counts[mark] += 1;
      const owing = roster.filter((s) => s.balanceCents > 0);
      const summary: ClassSummary = {
        ...counts,
        unmarked: roster.filter((s) => !session.marks[s.id]).length,
        collectedCents: next.payments.filter((p) => p.date === session.date).reduce((sum, p) => sum + p.amountCents, 0),
        outstandingCents: owing.reduce((sum, s) => sum + s.balanceCents, 0),
        outstandingStudents: owing.length,
        packagesUsed,
      };
      return { ...next, classSession: { ...session, status: "recorded", summary } };
    }
    case "recordPayment": {
      const next = updateStudent(state, action.studentId, (s) => withBalance(s, -action.amountCents));
      const payments = [{ id: `pay${state.seq}`, studentId: action.studentId, date: action.date, amountCents: action.amountCents, method: action.method }, ...next.payments];
      return addEvent({ ...next, payments }, stamp, { kind: "payment", title: "Payment received", studentId: action.studentId, subject: nameOf(state, action.studentId), detail: `${formatMoney(action.amountCents)} · ${action.method[0]?.toUpperCase()}${action.method.slice(1)}` });
    }
    case "adjustBalance": {
      const next = updateStudent(state, action.studentId, (s) => withBalance(s, action.deltaCents));
      return addEvent(next, stamp, { kind: "adjustment", title: "Balance adjusted", studentId: action.studentId, subject: nameOf(state, action.studentId), detail: `${action.deltaCents > 0 ? "+" : "−"}${formatMoney(action.deltaCents)} · ${action.reason}` });
    }
    case "logSession": {
      const applied = applySession(state, action.studentId, action.date, action.mark);
      return addEvent(applied.state, stamp, { kind: "attendance", title: "Session logged", studentId: action.studentId, subject: nameOf(state, action.studentId), detail: applied.detail });
    }
    case "toggleEnrolled": {
      const enrolled = !state.students.find((s) => s.id === action.studentId)?.enrolled;
      const next = updateStudent(state, action.studentId, (s) => ({ ...s, enrolled }));
      return addEvent(next, stamp, { kind: "schedule", title: enrolled ? "Added to class" : "Removed from class", studentId: action.studentId, subject: nameOf(state, action.studentId), detail: state.classSession.title });
    }
    case "archiveStudent": {
      const next = updateStudent(state, action.studentId, (s) => ({ ...s, status: "archived", enrolled: false }));
      return addEvent(next, stamp, { kind: "student", title: "Student archived", studentId: action.studentId, subject: nameOf(state, action.studentId), detail: "History and balance kept" });
    }
    case "updateStudent": {
      const next = updateStudent(state, action.studentId, (s) => ({ ...s, name: action.name, rateCents: action.rateCents }));
      return addEvent(next, stamp, { kind: "student", title: "Student updated", studentId: action.studentId, subject: action.name, detail: `Drop-in rate ${formatMoney(action.rateCents)}` });
    }
    case "saveNotes":
      return updateStudent(state, action.studentId, (s) => ({ ...s, notes: action.notes }));
    case "createPackage": {
      const next = { ...state, packages: [...state.packages, { ...action.definition, id: `pkg${state.seq}` }] };
      return addEvent(next, stamp, { kind: "package", title: "Package created", subject: action.definition.name, detail: formatMoney(action.definition.priceCents) });
    }
    case "setPackageArchived": {
      const def = state.packages.find((p) => p.id === action.packageId);
      const next = { ...state, packages: state.packages.map((p) => p.id === action.packageId ? { ...p, archived: action.archived } : p) };
      return addEvent(next, stamp, { kind: "package", title: action.archived ? "Package archived" : "Package restored", subject: def?.name ?? "Package", detail: "Assigned copies are unchanged" });
    }
    case "assignPackage": {
      const def = state.packages.find((p) => p.id === action.packageId);
      if (!def) return state;
      const assigned: StudentPackage = { id: `sp${state.seq}`, studentId: action.studentId, packageId: def.id, name: def.name, kind: def.kind, classCount: def.classCount, priceCents: def.priceCents, startDate: action.startDate, endDate: action.endDate, used: 0 };
      const next = updateStudent({ ...state, studentPackages: [...state.studentPackages, assigned] }, action.studentId, (s) => withBalance(s, def.priceCents));
      return addEvent(next, stamp, { kind: "package", title: "Package assigned", studentId: action.studentId, subject: nameOf(state, action.studentId), detail: `${def.name} · ${formatMoney(def.priceCents)} charged` });
    }
  }
}

export function createSeedState(today = barbadosToday()): LedgerState {
  const d = (days: number) => addDays(today, days);
  const student = (id: string, name: string, balanceCents: number, extra: Partial<Student> = {}): Student => ({ id, name, status: "active", memberSince: d(-120), rateCents: 3000, balanceCents, overdue: false, enrolled: true, notes: "", ...extra });
  const packages: PackageDefinition[] = [
    { id: "term12", name: "12-Class Term", description: "Valid for 12 weeks. Adult gymnastics.", kind: "class_pack", classCount: 12, priceCents: 30000, validityWeeks: 12, archived: false },
    { id: "pack6", name: "6-Class Pack", description: "Flexible six classes.", kind: "class_pack", classCount: 6, priceCents: 18000, validityWeeks: 8, archived: false },
    { id: "dropin", name: "Drop-in Class", description: "Single class.", kind: "class_pack", classCount: 1, priceCents: 3000, validityWeeks: null, archived: false },
    { id: "term10s", name: "10-Class Term (Students)", description: "Student pricing with valid ID.", kind: "class_pack", classCount: 10, priceCents: 25000, validityWeeks: 10, archived: false },
    { id: "summer", name: "Summer Unlimited", description: "Unlimited classes through the summer.", kind: "time_based", classCount: null, priceCents: 20000, validityWeeks: 8, archived: true },
  ];
  const held = (id: string, studentId: string, def: PackageDefinition, startDate: string, used: number): StudentPackage => ({ id, studentId, packageId: def.id, name: def.name, kind: def.kind, classCount: def.classCount, priceCents: def.priceCents, startDate, endDate: packageEndDate(startDate, def.validityWeeks), used });
  const [term12, pack6, , term10s] = packages as [PackageDefinition, PackageDefinition, PackageDefinition, PackageDefinition];
  const event = (id: string, kind: EventKind, title: string, subject: string, detail: string, days: number, time: string, studentId?: string, actor = "Coach"): ActivityEvent => ({ id, kind, title, subject, detail, date: d(days), time, studentId, actor });
  return {
    today,
    seq: 100,
    students: [
      student("abigail", "Abigail Daniel", -30000, { memberSince: d(-35) }),
      student("arielle", "Arielle Best", 0),
      student("caiden", "Caiden", 6000, { overdue: true }),
      student("charisma", "Charisma", 10000, { overdue: true }),
      student("johno", "Johno", 0),
      student("maya", "Maya Clarke", 3000),
      student("joel", "Joel King", -2000),
      student("ana", "Ana Griffith", 0),
      student("marcus", "Marcus Holder", 0),
      student("dana", "Dana Small", 0, { enrolled: false }),
    ],
    packages,
    studentPackages: [
      held("sp1", "abigail", term12, d(-28), 8),
      held("sp2", "abigail", pack6, d(-100), 6),
      held("sp3", "ana", pack6, d(-10), 2),
      held("sp4", "marcus", term10s, d(-21), 3),
    ],
    payments: [{ id: "pay1", studentId: "arielle", date: d(-1), amountCents: 6000, method: "cash" }],
    events: [
      event("e5", "payment", "Payment received", "Arielle Best", "$60.00 · Cash", -1, "19:42", "arielle"),
      event("e4", "attendance", "Attendance marked", "Caiden", "Present · $30.00 charged", -7, "19:05", "caiden"),
      event("e3", "student", "Student added", "Charisma", "Adult Gymnastics", -8, "13:12", "charisma"),
      event("e2", "schedule", "Recurring class updated", "Adult Gymnastics", "Tuesdays 7:00 PM", -9, "15:20"),
      event("e1", "void", "Payment voided", "Johno", "$30.00 · Entered twice", -10, "18:15", "johno"),
      event("e0", "package", "Package assigned", "Abigail Daniel", "12-Class Term · $300.00 charged", -28, "18:30", "abigail"),
    ],
    classSession: { title: "Adult Gymnastics", date: today, start: "19:00", end: "20:30", status: "upcoming", marks: {} },
  };
}

type History = { present: LedgerState; past: { state: LedgerState; label: string }[] };

/**
 * In-memory stand-in for the audited Supabase RPCs. Every mutation keeps the
 * prior state so the Undo toast can restore it; swap this for server actions
 * without changing screen props.
 */
export function useLedgerStore(initial?: () => LedgerState) {
  const [history, dispatch] = useReducer(
    (current: History, action: { kind: "apply"; action: LedgerAction; label: string; stamp: Stamp } | { kind: "undo" }): History => {
      if (action.kind === "undo") {
        const [last, ...rest] = current.past;
        return last ? { present: last.state, past: rest } : current;
      }
      const present = ledgerReducer(current.present, { ...action.action, stamp: action.stamp });
      // Draft attendance marks are not undoable operations.
      return action.action.type === "mark" ? { ...current, present } : { present, past: [{ state: current.present, label: action.label }, ...current.past].slice(0, 20) };
    },
    undefined,
    () => ({ present: (initial ?? createSeedState)(), past: [] }),
  );
  return {
    state: history.present,
    canUndo: history.past.length > 0,
    apply(action: LedgerAction, label = "") {
      const now = new Date();
      dispatch({ kind: "apply", action, label, stamp: { date: barbadosToday(now), time: barbadosTime(now) } });
    },
    undo() { dispatch({ kind: "undo" }); },
  };
}

export type LedgerStore = ReturnType<typeof useLedgerStore>;

export function remainingText(pkg: StudentPackage) {
  const remaining = remainingClasses(pkg);
  return remaining === null ? "Unlimited" : `${remaining} remaining`;
}

