"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { bulkMarkAttended, correctPayment, logPayment, markDailyReviewed, previewTemplateSchedule, saveSession, saveStudent, saveTemplate, saveTemplateSchedule, materializeRecurringSessions, undoOperation, type MutationResult } from "../actions/ledger";
import { signOut } from "../actions/auth";

type View = "today" | "students" | "activity" | "more";
export type BalanceState = "overdue" | "owed" | "settled" | "credit";
export type SessionStatus = "scheduled" | "held" | "canceled" | "no_show";

export type StudentReadModel = {
  id: string;
  name: string;
  balanceCents: number;
  balanceState: BalanceState;
  todaySessionStatus: SessionStatus | null;
  lastAttendedOn: string | null;
  defaultRateCents?: number;
  notes?: string | null;
  version?: number;
  archived?: boolean;
  history?: StudentHistoryEntryReadModel[];
};

export type StudentHistoryEntryReadModel = {
  id: string;
  kind: "session" | "payment";
  studentId?: string;
  studentName?: string;
  date?: string;
  dateLabel: string;
  label: string;
  detail: string;
  voided: boolean;
  voidReason?: string | null;
  version?: number;
  status?: SessionStatus;
  chargeRateCents?: number | null;
  amountCents?: number;
  method?: "cash" | "transfer" | "other";
  notes?: string | null;
  replacementPaymentId?: string | null;
};

export type ActivityReadModel = {
  id: string;
  label: string;
  occurredAtLabel: string;
};

export type TimelineEntryReadModel = {
  id: string;
  kind: "session" | "payment" | "administrative";
  studentId: string | null;
  studentName: string | null;
  date: string;
  dateLabel: string;
  label: string;
  detail: string;
  entry?: StudentHistoryEntryReadModel;
};

export type DailyEntryReadModel = {
  id: string;
  kind: "session" | "payment";
  studentName: string;
  label: string;
  detail: string;
  entry: StudentHistoryEntryReadModel;
};

export type TemplateReadModel = {
  id: string;
  studentId: string;
  studentName: string;
  weekday: number;
  weekdayLabel: string;
  startsOn: string;
  endsOn: string | null;
  nextSessionOn: string | null;
  paused: boolean;
  version: number;
};

export type TemplatePreviewReadModel = {
  templateId: string;
  expectedVersion: number;
  oldSchedule: { weekday: number; startsOn: string; endsOn: string | null };
  newSchedule: { weekday: number; startsOn: string; endsOn: string | null };
  affectedCount: number;
  excludedCount: number;
  conflictCount: number;
  changes: { sessionId: string; oldDate: string; newDate: string }[];
};

export type AdultAdminReadModel = {
  todayDate: string;
  todayLabel: string;
  students: StudentReadModel[];
  activities: ActivityReadModel[];
  timeline: TimelineEntryReadModel[];
  dailyEntries: DailyEntryReadModel[];
  templates: TemplateReadModel[];
  setup: { student: boolean; template: boolean; attendance: boolean; payment: boolean };
  insights: { unresolvedSessions: number; recentPayments: number; upcomingClasses: number; inactiveStudents: number };
  review: {
    date: string;
    reviewed: boolean;
    heldCount: number;
    noShowCount: number;
    collectedCents: number;
    scheduledCount: number;
  };
  period: {
    label: string;
    totalOwedCents: number;
    totalCreditCents: number;
    attendanceCount: number;
    collectedCents: number;
  };
};

export const EMPTY_ADULT_ADMIN_DATA: AdultAdminReadModel = {
  todayDate: "",
  todayLabel: "Today",
  students: [],
  activities: [],
  timeline: [],
  dailyEntries: [],
  templates: [],
  setup: { student: false, template: false, attendance: false, payment: false },
  insights: { unresolvedSessions: 0, recentPayments: 0, upcomingClasses: 0, inactiveStudents: 0 },
  review: { date: "", reviewed: false, heldCount: 0, noShowCount: 0, collectedCents: 0, scheduledCount: 0 },
  period: { label: "Current period", totalOwedCents: 0, totalCreditCents: 0, attendanceCount: 0, collectedCents: 0 },
};

type UndoState = { operationId: string; message: string };

const money = (cents: number) => new Intl.NumberFormat("en-BB", { style: "currency", currency: "BBD" }).format(Math.abs(cents) / 100).replace("BBD", "$");
const balanceLabel = (student: StudentReadModel) => student.balanceState === "credit" ? `Credit ${money(student.balanceCents)}` : student.balanceState === "settled" ? "Settled" : `${student.balanceState === "overdue" ? "Overdue · " : ""}Owes ${money(student.balanceCents)}`;
const statusLabel = (status: SessionStatus | null) => status ? ({ scheduled: "Scheduled", held: "Held", canceled: "Canceled", no_show: "No-show" } as const)[status] : "Not scheduled";

function operationId(result: MutationResult) {
  if (!result.ok || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) return null;
  const value = (result.data as Record<string, unknown>).operationId;
  return typeof value === "string" ? value : null;
}

function resultMessage(result: MutationResult) {
  if (result.ok) return null;
  if (result.code === "VALIDATION") return Object.values(result.fields).flat()[0] ?? "Check the entered values and try again.";
  return result.message;
}

function freshIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function AdultAdminApp({ data = EMPTY_ADULT_ADMIN_DATA, initialView = "today", initialActivityTab = "timeline", initialTimelineFilters = {} }: { data?: AdultAdminReadModel; initialView?: View; initialActivityTab?: "timeline" | "day"; initialTimelineFilters?: { student?: string; type?: string; from?: string; to?: string } }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [modal, setModal] = useState<"bulk" | "payment" | "session" | "entry" | "student" | "studentDetail" | "archive" | "template" | "templateArchive" | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentReadModel | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TemplateReadModel | null>(null);
  const [editingEntry, setEditingEntry] = useState<StudentHistoryEntryReadModel | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | BalanceState>("all");
  const [rosterStatus, setRosterStatus] = useState<"active" | "archived">("active");
  const [paymentStudentId, setPaymentStudentId] = useState<string | null>(null);
  const [sessionStudentId, setSessionStudentId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const activeStudents = useMemo(() => data.students.filter((student) => !student.archived), [data.students]);
  const filtered = useMemo(() => data.students.filter((student) => Boolean(student.archived) === (rosterStatus === "archived") && student.name.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || student.balanceState === filter)), [data.students, filter, query, rosterStatus]);

  useEffect(() => {
    if (!undo) return;
    const timeout = window.setTimeout(() => setUndo(null), 10 * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, [undo]);

  function openBulk() {
    setSelected(activeStudents.filter((student) => student.todaySessionStatus !== "canceled").map((student) => student.id));
    setBulkReviewing(false);
    setModal("bulk");
  }

  function openStudent(student: StudentReadModel | null = null) {
    setEditingStudent(student);
    setModal("student");
  }

  function viewStudent(student: StudentReadModel) {
    setEditingStudent(student);
    setModal("studentDetail");
  }

  function openEntry(entry: StudentHistoryEntryReadModel) {
    setEditingEntry(entry);
    setFormError(null);
    setModal("entry");
  }

  function openPayment(studentId?: string) {
    setPaymentStudentId(studentId ?? activeStudents[0]?.id ?? null);
    setPaymentIdempotencyKey(freshIdempotencyKey());
    setModal("payment");
  }


  function openSession(studentId?: string) {
    setSessionStudentId(studentId ?? activeStudents[0]?.id ?? null);
    setModal("session");
  }

  function showOverdueStudents() {
    setRosterStatus("active");
    setFilter("overdue");
    setQuery("");
    setView("students");
  }

  async function confirmBulk() {
    setNotice(null);
    setIsPending(true);
    try {
      const result = await bulkMarkAttended({ idempotencyKey: freshIdempotencyKey(), sessionDate: data.todayDate, studentIds: selected });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      const id = operationId(result);
      setModal(null);
      if (id) setUndo({ operationId: id, message: `${selected.length} students marked held` });
      router.refresh();
    } catch { setNotice("The attendance could not be saved. Please try again."); }
    finally { setIsPending(false); }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amountCents = Math.round(Number(form.get("amount")) * 100);
    setNotice(null);
    setIsPending(true);
    try {
      const result = await logPayment({
        idempotencyKey: paymentIdempotencyKey ?? freshIdempotencyKey(),
        studentId: String(form.get("student")),
        paymentDate: String(form.get("date")),
        amountCents,
        method: String(form.get("method")),
      });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      const id = operationId(result);
      setModal(null);
      setPaymentIdempotencyKey(null);
      if (id) setUndo({ operationId: id, message: `Payment of ${money(amountCents)} recorded` });
      router.refresh();
    } catch { setNotice("The payment could not be saved. Your entered values are safe to retry."); }
    finally { setIsPending(false); }
  }

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status")) as SessionStatus;
    setNotice(null);
    setIsPending(true);
    try {
      const result = await saveSession({
        idempotencyKey: freshIdempotencyKey(),
        sessionId: null,
        studentId: String(form.get("student")),
        sessionDate: String(form.get("date")),
        status,
        void: false,
        voidReason: null,
        expectedVersion: null,
      });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      const id = operationId(result);
      setModal(null);
      if (id) setUndo({ operationId: id, message: `${statusLabel(status)} session saved` });
      router.refresh();
    } catch { setNotice("The session could not be saved. Your entered values are safe to retry."); }
    finally { setIsPending(false); }
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEntry?.studentId || !editingEntry.version || !editingEntry.date) return setFormError("Refresh before changing this entry.");
    const form = new FormData(event.currentTarget);
    setFormError(null);
    setIsPending(true);
    try {
      if (editingEntry.kind === "payment") {
        const replace = form.get("replacement") === "on";
        const amountCents = Math.round(Number(form.get("amount")) * 100);
        const result = await correctPayment({
          idempotencyKey: freshIdempotencyKey(),
          paymentId: editingEntry.id,
          expectedVersion: editingEntry.version,
          voidReason: String(form.get("voidReason")),
          replacement: replace ? { paymentDate: String(form.get("date")), amountCents, method: String(form.get("method")), notes: String(form.get("notes") ?? "") || null } : null,
        });
        const error = resultMessage(result);
        if (error) return setFormError(error);
        setNotice(replace ? `${editingEntry.studentName ?? "Student"}'s payment was corrected.` : `${editingEntry.studentName ?? "Student"}'s payment was voided.`);
      } else {
        const shouldVoid = form.get("void") === "on";
        const status = String(form.get("status")) as SessionStatus;
        const result = await saveSession({ idempotencyKey: freshIdempotencyKey(), sessionId: editingEntry.id, studentId: editingEntry.studentId, sessionDate: String(form.get("date")), status, void: shouldVoid, voidReason: shouldVoid ? String(form.get("voidReason")) : null, expectedVersion: editingEntry.version });
        const error = resultMessage(result);
        if (error) return setFormError(error);
        setNotice(shouldVoid ? `${editingEntry.studentName ?? "Student"}'s session was voided.` : `${editingEntry.studentName ?? "Student"}'s session was updated.`);
      }
      setModal(null);
      setEditingEntry(null);
      router.refresh();
    } catch { setFormError("The entry could not be changed. Your entered values are safe to retry."); }
    finally { setIsPending(false); }
  }

  async function submitStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rateCents = Math.round(Number(form.get("rate")) * 100);
    setNotice(null);
    setIsPending(true);
    try {
      const result = await saveStudent({
        idempotencyKey: freshIdempotencyKey(),
        studentId: editingStudent?.id,
        name: String(form.get("name")),
        defaultRateCents: rateCents,
        notes: String(form.get("notes") ?? ""),
        archived: editingStudent?.archived ?? false,
        expectedVersion: editingStudent?.version,
      });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      setModal(null);
      setEditingStudent(null);
      setNotice(editingStudent ? "Student updated" : "Student added");
      router.refresh();
    } catch { setNotice("The student could not be saved. Your entered values are safe to retry."); }
    finally { setIsPending(false); }
  }

  async function archiveStudent() {
    if (!editingStudent?.version) return setNotice("Refresh before archiving this student.");
    setNotice(null);
    setIsPending(true);
    try {
      const result = await saveStudent({
        idempotencyKey: freshIdempotencyKey(),
        studentId: editingStudent.id,
        name: editingStudent.name,
        defaultRateCents: editingStudent.defaultRateCents ?? 3000,
        notes: editingStudent.notes ?? null,
        archived: true,
        expectedVersion: editingStudent.version,
      });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      setModal(null);
      setEditingStudent(null);
      setNotice("Student archived. Attendance and payment history was preserved.");
      router.refresh();
    } catch { setNotice("The student could not be archived. Please refresh and try again."); }
    finally { setIsPending(false); }
  }

  async function restoreStudent() {
    if (!editingStudent?.version) return setNotice("Refresh before restoring this student.");
    setNotice(null);
    setIsPending(true);
    try {
      const result = await saveStudent({
        idempotencyKey: freshIdempotencyKey(),
        studentId: editingStudent.id,
        name: editingStudent.name,
        defaultRateCents: editingStudent.defaultRateCents ?? 3000,
        notes: editingStudent.notes ?? null,
        archived: false,
        expectedVersion: editingStudent.version,
      });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      setModal(null);
      setEditingStudent(null);
      setNotice("Student restored to the active roster.");
      router.refresh();
    } catch { setNotice("The student could not be restored. Please refresh and try again."); }
    finally { setIsPending(false); }
  }

  async function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice(null);
    setIsPending(true);
    try {
      const input = {
        idempotencyKey: freshIdempotencyKey(),
        templateId: editingTemplate?.id ?? null,
        studentId: String(form.get("student")),
        weekday: Number(form.get("weekday")),
        startsOn: String(form.get("startsOn")),
        endsOn: String(form.get("endsOn") ?? "") || null,
        paused: editingTemplate?.paused ?? false,
        archived: false,
        expectedVersion: editingTemplate?.version ?? null,
      };
      const result = editingTemplate
        ? await saveTemplateSchedule({ ...input, templateId: editingTemplate.id, expectedVersion: editingTemplate.version, futureMode: String(form.get("futureMode") ?? "keep") })
        : await saveTemplate(input);
      const error = resultMessage(result);
      if (error) return setNotice(error);

      const generated = await materializeRecurringSessions({ idempotencyKey: freshIdempotencyKey() });
      const generationError = resultMessage(generated);
      setModal(null);
      setEditingTemplate(null);
      if (generationError) setNotice(`Recurring class saved, but sessions could not be generated: ${generationError}`);
      else setNotice(editingTemplate ? "Recurring class updated" : "Recurring class created and upcoming sessions scheduled");
      router.refresh();
    } catch { setNotice("The recurring class could not be saved. Please try again."); }
    finally { setIsPending(false); }
  }

  async function setTemplateState(template: TemplateReadModel, changes: { paused?: boolean; archived?: boolean }) {
    setNotice(null);
    setIsPending(true);
    try {
      const paused = changes.paused ?? template.paused;
      const archived = changes.archived ?? false;
      const result = await saveTemplate({ idempotencyKey: freshIdempotencyKey(), templateId: template.id, studentId: template.studentId, weekday: template.weekday, startsOn: template.startsOn, endsOn: template.endsOn, paused, archived, expectedVersion: template.version });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      if (!paused && !archived) await materializeRecurringSessions({ idempotencyKey: freshIdempotencyKey() });
      setModal(null);
      setEditingTemplate(null);
      setNotice(archived ? "Recurring class archived. Existing sessions were preserved." : paused ? "Recurring class paused" : "Recurring class resumed and upcoming sessions scheduled");
      router.refresh();
    } catch { setNotice("The recurring class could not be updated. Refresh and try again."); }
    finally { setIsPending(false); }
  }

  async function markReviewed() {
    setNotice(null);
    setIsPending(true);
    try {
      const result = await markDailyReviewed({ idempotencyKey: freshIdempotencyKey(), reviewDate: data.review.date });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      setNotice("Day marked reviewed");
      router.refresh();
    } catch { setNotice("The review could not be saved. Please try again."); }
    finally { setIsPending(false); }
  }

  async function undoLast() {
    if (!undo) return;
    setNotice(null);
    setIsPending(true);
    try {
      const result = await undoOperation({ idempotencyKey: freshIdempotencyKey(), operationId: undo.operationId });
      const error = resultMessage(result);
      if (error) return setNotice(error);
      setUndo(null);
      setNotice("Last action undone");
      router.refresh();
    } catch { setNotice("The change could not be undone. Refresh and check its current state."); }
    finally { setIsPending(false); }
  }

  return (
    <div className="app-frame" aria-busy={isPending}>
      <aside className="side-nav" aria-label="Primary navigation"><Brand />{navItems.map((item) => <NavButton key={item.id} item={item} view={view} setView={setView} />)}</aside>
      <div className="app-content">
        <header className="topbar"><Brand /><span className="save-state"><i /> {isPending ? "Saving…" : "All changes saved"}</span></header>
        <main id="main-content" className="main-content">
          {notice && <div className="review-state app-notice" role="status"><span aria-hidden="true">!</span><div><b>{notice}</b></div><button className="text-button" onClick={() => setNotice(null)}>Dismiss</button></div>}
          {view === "today" && <Today data={{ ...data, students: activeStudents }} onBulk={openBulk} onPay={openPayment} onSession={() => openSession()} onView={viewStudent} onAddStudent={() => openStudent()} onShowOverdue={showOverdueStudents} onTemplates={() => setView("more")} onActivity={(type) => router.push(`/?view=activity&tab=timeline&type=${type}`)} onInactive={() => { setRosterStatus("active"); setView("students"); }} />}
          {view === "students" && <Students students={filtered} activeCount={activeStudents.length} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} rosterStatus={rosterStatus} setRosterStatus={setRosterStatus} onPay={openPayment} onAdd={() => openStudent()} onEdit={openStudent} onView={viewStudent} />}
          {view === "activity" && <Activity data={data} initialTab={initialActivityTab} initialFilters={initialTimelineFilters} onNavigate={(params) => router.push(`/?${params.toString()}`)} onDateChange={(date) => router.push(`/?view=activity&tab=day&date=${date}`)} onEntry={openEntry} onReview={markReviewed} onResolve={() => setView("today")} isPending={isPending} />}
          {view === "more" && <Templates templates={data.templates} canCreate={activeStudents.length > 0} onAdd={() => { setEditingTemplate(null); setModal("template"); }} onEdit={(template) => { setEditingTemplate(template); setModal("template"); }} />}
        </main>
        <nav className="bottom-nav" aria-label="Primary navigation">{navItems.map((item) => <NavButton key={item.id} item={item} view={view} setView={setView} />)}</nav>
      </div>
      {modal === "bulk" && <BulkDialog date={data.todayLabel} students={activeStudents} selected={selected} setSelected={setSelected} reviewing={bulkReviewing} setReviewing={setBulkReviewing} onClose={() => setModal(null)} onConfirm={confirmBulk} isPending={isPending} />}
      {modal === "payment" && <PaymentDialog date={data.todayDate} students={activeStudents} selectedStudentId={paymentStudentId} onClose={() => { setModal(null); setPaymentStudentId(null); setPaymentIdempotencyKey(null); }} onSubmit={submitPayment} isPending={isPending} />}
      {modal === "session" && <SessionDialog date={data.todayDate} students={activeStudents} selectedStudentId={sessionStudentId} onClose={() => { setModal(null); setSessionStudentId(null); }} onSubmit={submitSession} isPending={isPending} />}
      {modal === "entry" && editingEntry && <EntryDialog entry={editingEntry} student={data.students.find((student) => student.id === editingEntry.studentId)} error={formError} onClose={() => { setModal(null); setEditingEntry(null); setFormError(null); }} onSubmit={submitEntry} isPending={isPending} />}
      {modal === "studentDetail" && editingStudent && <StudentDetailDialog student={editingStudent} onClose={() => { setModal(null); setEditingStudent(null); }} onPay={() => openPayment(editingStudent.id)} onSession={() => openSession(editingStudent.id)} onEdit={() => setModal("student")} onEntry={openEntry} />}
      {modal === "student" && <StudentDialog student={editingStudent} onClose={() => { setModal(null); setEditingStudent(null); }} onSubmit={submitStudent} onArchive={editingStudent?.version && !editingStudent.archived ? () => setModal("archive") : undefined} onRestore={editingStudent?.version && editingStudent.archived ? restoreStudent : undefined} isPending={isPending} />}
      {modal === "archive" && editingStudent && <ArchiveStudentDialog student={editingStudent} onClose={() => setModal("student")} onConfirm={archiveStudent} isPending={isPending} />}
      {modal === "template" && <TemplateDialog template={editingTemplate} students={activeStudents} defaultDate={data.todayDate} onClose={() => { setModal(null); setEditingTemplate(null); }} onSubmit={submitTemplate} onToggle={editingTemplate ? () => setTemplateState(editingTemplate, { paused: !editingTemplate.paused }) : undefined} onArchive={editingTemplate ? () => setModal("templateArchive") : undefined} isPending={isPending} />}
      {modal === "templateArchive" && editingTemplate && <ArchiveTemplateDialog template={editingTemplate} onClose={() => setModal("template")} onConfirm={() => setTemplateState(editingTemplate, { archived: true })} isPending={isPending} />}
      {undo && <div className="undo-toast" role="status"><span>{undo.message}<small>Undo available for 10 minutes</small></span><button disabled={isPending} onClick={undoLast}>Undo</button><button aria-label="Dismiss notification" onClick={() => setUndo(null)}>×</button></div>}
    </div>
  );
}

const navItems: { id: View; label: string; icon: string }[] = [{ id: "today", label: "Today", icon: "⌂" }, { id: "students", label: "Students", icon: "♙" }, { id: "activity", label: "Activity", icon: "≋" }, { id: "more", label: "More", icon: "•••" }];
function Brand() { return <div className="brand"><span className="brand-mark">C</span><span><b>ChalkTab</b><small>Attendance & payments</small></span></div>; }
function NavButton({ item, view, setView }: { item: typeof navItems[number]; view: View; setView: (v: View) => void }) { return <button className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>; }
function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</header>; }
function Balance({ student }: { student: StudentReadModel }) { return <span className={`balance ${student.balanceState}`}><span aria-hidden="true">{student.balanceState === "overdue" ? "▲" : student.balanceState === "credit" ? "↓" : student.balanceState === "settled" ? "✓" : "○"}</span>{balanceLabel(student)}</span>; }
function Status({ value }: { value: SessionStatus | null }) { return <span className={`status ${(value ?? "unscheduled").replace("_", "")}`}>{statusLabel(value)}</span>; }

function Today({ data, onBulk, onPay, onSession, onView, onAddStudent, onShowOverdue, onTemplates, onActivity, onInactive }: { data: AdultAdminReadModel; onBulk: () => void; onPay: (studentId?: string) => void; onSession: () => void; onView: (student: StudentReadModel) => void; onAddStudent: () => void; onShowOverdue: () => void; onTemplates: () => void; onActivity: (type: string) => void; onInactive: () => void }) {
  const overdueCount = data.students.filter((student) => student.balanceState === "overdue").length;
  const scheduledCount = data.students.filter((student) => student.todaySessionStatus === "scheduled").length;
  const heldCount = data.students.filter((student) => student.todaySessionStatus === "held").length;
  return <><PageHeading eyebrow={data.todayLabel} title="Today" />
    <SetupChecklist setup={data.setup} onAddStudent={onAddStudent} onTemplates={onTemplates} onAttendance={onBulk} onPayment={() => onPay()} />
    <section className="insight-grid" aria-label="Operational insights"><button onClick={onBulk}><span>Unresolved sessions</span><b>{data.insights.unresolvedSessions}</b><small>Review attendance →</small></button><button onClick={() => onActivity("payment")}><span>Payments · last 7 days</span><b>{data.insights.recentPayments}</b><small>Open timeline →</small></button><button onClick={onTemplates}><span>Classes · next 7 days</span><b>{data.insights.upcomingClasses}</b><small>Review schedule →</small></button><button onClick={onInactive}><span>No held attendance · 30 days</span><b>{data.insights.inactiveStudents}</b><small>Review students →</small></button></section>
    {overdueCount > 0 && <button className="alert-card" onClick={onShowOverdue}><span aria-hidden="true">!</span><b>{overdueCount} {overdueCount === 1 ? "student is" : "students are"} overdue</b><small>View outstanding balances →</small></button>}
    <section className="section"><div className="section-title"><div><p className="eyebrow">Today’s class</p><h2>{scheduledCount} scheduled · {heldCount} held</h2></div><div className="section-actions"><button className="secondary" disabled={!data.students.length} onClick={onSession}>+ Session</button><button className="secondary" disabled={!data.students.length} onClick={() => onPay()}>+ Payment</button></div></div>
      {data.students.length ? <div className="student-list">{data.students.map((student) => <article className="student-row" key={student.id}><button className="student-open" onClick={() => onView(student)} aria-label={`View ${student.name}`}><span className="avatar" aria-hidden="true">{student.name.split(" ").map((part) => part[0]).join("")}</span><span className="student-copy"><strong>{student.name}</strong><Balance student={student} /></span></button><button className="quick-pay" onClick={() => onPay(student.id)} aria-label={`Record payment for ${student.name}`}>Pay</button><Status value={student.todaySessionStatus} /></article>)}</div> : <EmptyLedger onAdd={onAddStudent} />}
    </section>
    <section className="section recent"><div className="section-title"><h2>Recent activity</h2></div>{data.activities.length ? data.activities.slice(0, 3).map((activity) => <div className="activity-row" key={activity.id}><span className="activity-icon">✓</span><span>{activity.label}<small>{activity.occurredAtLabel}</small></span></div>) : <div className="empty"><b>No activity yet</b><p>Attendance and payments will appear here after you log them.</p></div>}</section>
    <div className="sticky-action"><button className="primary" disabled={!data.students.length || !data.todayDate} onClick={onBulk}><span aria-hidden="true">✓</span> Mark attendance</button></div></>;
}

const SETUP_DISMISSAL_KEY = "chalktab:setup:v1:dismissed";
const SETUP_DISMISSAL_EVENT = "chalktab-setup-dismissed";
function SetupChecklist({ setup, onAddStudent, onTemplates, onAttendance, onPayment }: { setup: AdultAdminReadModel["setup"]; onAddStudent: () => void; onTemplates: () => void; onAttendance: () => void; onPayment: () => void }) {
  const dismissed = useSyncExternalStore(
    (notify) => { window.addEventListener(SETUP_DISMISSAL_EVENT, notify); return () => window.removeEventListener(SETUP_DISMISSAL_EVENT, notify); },
    () => window.localStorage.getItem(SETUP_DISMISSAL_KEY) === "true",
    () => true,
  );
  const steps = [
    ["student", "Add student", onAddStudent], ["template", "Create recurring class", onTemplates],
    ["attendance", "Record attendance", onAttendance], ["payment", "Record payment", onPayment],
  ] as const;
  if (dismissed || Object.values(setup).every(Boolean)) return null;
  return <section className="setup-card" aria-label="Setup checklist"><div className="section-title"><div><p className="eyebrow">Getting started</p><h2>Finish setting up ChalkTab</h2></div><button className="icon-button" aria-label="Dismiss setup checklist" onClick={() => { window.localStorage.setItem(SETUP_DISMISSAL_KEY, "true"); window.dispatchEvent(new Event(SETUP_DISMISSAL_EVENT)); }}>×</button></div><ol>{steps.map(([key, label, action]) => <li className={setup[key] ? "done" : ""} key={key}><span aria-hidden="true">{setup[key] ? "✓" : "○"}</span><button disabled={setup[key]} onClick={action}>{label}</button></li>)}</ol></section>;
}

function EmptyLedger({ onAdd }: { onAdd: () => void }) { return <div className="empty"><b>Your ledger is ready</b><p>Add your first student to start tracking attendance and payments. No demo records have been added.</p><button className="primary compact" onClick={onAdd}>Add first student</button></div>; }

function Students({ students, activeCount, query, setQuery, filter, setFilter, rosterStatus, setRosterStatus, onPay, onAdd, onEdit, onView }: { students: StudentReadModel[]; activeCount: number; query: string; setQuery: (value: string) => void; filter: "all" | BalanceState; setFilter: (value: "all" | BalanceState) => void; rosterStatus: "active" | "archived"; setRosterStatus: (value: "active" | "archived") => void; onPay: (studentId: string) => void; onAdd: () => void; onEdit: (student: StudentReadModel) => void; onView: (student: StudentReadModel) => void }) {
  const activeRosterEmpty = rosterStatus === "active" && activeCount === 0;
  return <><PageHeading eyebrow="Roster" title="Students"><button className="primary compact" onClick={onAdd}>+ Add student</button></PageHeading><div className="roster-tabs" role="group" aria-label="Roster status"><button className={rosterStatus === "active" ? "active" : ""} aria-pressed={rosterStatus === "active"} onClick={() => setRosterStatus("active")}>Active</button><button className={rosterStatus === "archived" ? "active" : ""} aria-pressed={rosterStatus === "archived"} onClick={() => setRosterStatus("archived")}>Archived</button></div><div className="search-row"><label className="search"><span>⌕</span><span className="sr-only">Search students</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" /></label><select aria-label="Filter by balance" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All balances</option><option value="overdue">Overdue</option><option value="owed">Owes</option><option value="settled">Settled</option><option value="credit">Credit</option></select></div><p className="result-count">{students.length} {rosterStatus} students</p><div className="student-grid">{students.map((student) => <article className="profile-card" key={student.id}><div className="avatar">{student.name[0]}</div><div><h2>{student.name}</h2><Balance student={student} /><p>{student.archived ? "Archived · history preserved" : student.lastAttendedOn ? `Last attended ${student.lastAttendedOn}` : "No attendance yet"}</p></div><div className="card-actions"><button className="secondary" onClick={() => onView(student)}>View</button><details className="overflow-menu"><summary aria-label={`More actions for ${student.name}`}>•••</summary><div>{!student.archived && <button onClick={() => onPay(student.id)}>Record payment</button>}<button onClick={() => onEdit(student)}>{student.archived ? "Restore student" : "Manage student"}</button></div></details></div></article>)}</div>{students.length === 0 && <div className="empty"><b>{activeRosterEmpty ? "No active students yet" : rosterStatus === "archived" ? "No archived students" : "No matching students"}</b><p>{activeRosterEmpty ? "Add your first student to begin. The app never inserts demo students automatically." : rosterStatus === "archived" ? "Archived students will appear here with their history and balances preserved." : "Try clearing your search or balance filter."}</p>{activeRosterEmpty && <button className="primary compact" onClick={onAdd}>Add first student</button>}</div>}</>;
}

function Activity({ data, initialTab, initialFilters, onNavigate, onDateChange, onEntry, onReview, onResolve, isPending }: { data: AdultAdminReadModel; initialTab: "timeline" | "day"; initialFilters: { student?: string; type?: string; from?: string; to?: string }; onNavigate: (params: URLSearchParams) => void; onDateChange: (date: string) => void; onEntry: (entry: StudentHistoryEntryReadModel) => void; onReview: () => void; onResolve: () => void; isPending: boolean }) {
  const review = data.review;
  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({ view: "activity", tab: initialTab, ...Object.fromEntries(Object.entries(initialFilters).filter(([, value]) => value)) as Record<string, string>, ...updates });
    for (const [key, value] of [...params]) if (!value) params.delete(key);
    onNavigate(params);
  }
  const timeline = data.timeline.filter((entry) => (!initialFilters.student || entry.studentId === initialFilters.student) && (!initialFilters.type || initialFilters.type === "all" || entry.kind === initialFilters.type) && (!initialFilters.from || entry.date >= initialFilters.from) && (!initialFilters.to || entry.date <= initialFilters.to));
  return <><PageHeading eyebrow="Ledger history" title="Activity" /><div className="activity-tabs" role="tablist" aria-label="Activity view"><button role="tab" aria-selected={initialTab === "timeline"} className={initialTab === "timeline" ? "active" : ""} onClick={() => navigate({ tab: "timeline" })}>Timeline</button><button role="tab" aria-selected={initialTab === "day"} className={initialTab === "day" ? "active" : ""} onClick={() => navigate({ tab: "day", date: review.date })}>Day review</button></div>{initialTab === "timeline" ? <><section className="timeline-filters" aria-label="Timeline filters"><label>Student<select value={initialFilters.student ?? ""} onChange={(event) => navigate({ student: event.target.value })}><option value="">All students</option>{data.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>Entry type<select value={initialFilters.type ?? "all"} onChange={(event) => navigate({ type: event.target.value })}><option value="all">All entries</option><option value="session">Sessions</option><option value="payment">Payments</option><option value="administrative">Administrative</option></select></label><label>From<input type="date" value={initialFilters.from ?? ""} onChange={(event) => navigate({ from: event.target.value })} /></label><label>To<input type="date" value={initialFilters.to ?? ""} onChange={(event) => navigate({ to: event.target.value })} /></label></section><section className="section"><div className="section-title"><h2>Ledger timeline</h2><span className="count">{timeline.length}</span></div>{timeline.length ? <div className="timeline-list">{timeline.map((item) => item.entry ? <button key={item.id} className="timeline-entry" onClick={() => onEntry(item.entry!)}><span className={`entry-kind ${item.kind}`}>{item.kind === "payment" ? "$" : "✓"}</span><span><b>{item.studentName}</b><span>{item.label}</span><small>{item.dateLabel} · {item.detail}</small></span><span aria-hidden="true">›</span></button> : <div key={item.id} className="timeline-entry"><span className="entry-kind administrative" aria-hidden="true">⚙</span><span><b>{item.label}</b><small>{item.dateLabel} · {item.detail}</small></span></div>)}</div> : <div className="empty"><b>No matching activity</b><p>Adjust the student, entry type, or date range filters.</p></div>}</section></> : <><div className="recap-date-nav"><button className="icon-button" aria-label="Previous day" onClick={() => onDateChange(shiftDate(review.date, -1))}>←</button><label className="date-control"><span className="sr-only">Recap date</span><input type="date" value={review.date} onChange={(event) => onDateChange(event.target.value)} /></label><button className="icon-button" aria-label="Next day" onClick={() => onDateChange(shiftDate(review.date, 1))}>→</button></div><div className={`review-state ${review.reviewed ? "done" : ""}`}><span>{review.reviewed ? "✓" : "○"}</span><div><b>{review.reviewed ? "Reviewed" : "Not reviewed yet"}</b><small>{review.reviewed ? "You can review again after later changes." : "Check the day’s entries before wrapping up."}</small></div></div><section className="metric-grid"><Metric label="Held" value={String(review.heldCount)} /><Metric label="No-show" value={String(review.noShowCount)} /><Metric label="Collected" value={money(review.collectedCents)} accent /><Metric label="Still scheduled" value={String(review.scheduledCount)} /></section><section className="section"><div className="section-title"><div><p className="eyebrow">Daily ledger</p><h2>Entries for this day</h2></div><span className="count">{data.dailyEntries.length}</span></div>{data.dailyEntries.length ? <div className="daily-entry-list">{data.dailyEntries.map((entry) => <button className="daily-entry" key={`${entry.kind}-${entry.id}`} onClick={() => onEntry(entry.entry)}><span className={`entry-kind ${entry.kind}`} aria-hidden="true">{entry.kind === "payment" ? "$" : "✓"}</span><span><b>{entry.studentName}</b><span>{entry.label}</span><small>{entry.detail}</small></span><span aria-hidden="true">›</span></button>)}</div> : <div className="empty compact-empty"><b>No entries for this date</b><p>Use the date controls to review another day.</p></div>}</section>{review.scheduledCount > 0 && <section className="section"><div className="warning"><b>{review.scheduledCount} sessions still scheduled</b><p>Confirm attendance or update status before wrapping up.</p><button onClick={onResolve}>Resolve on Today →</button></div></section>}<div className="sticky-action"><button className="primary" disabled={isPending || !review.date || review.scheduledCount > 0} onClick={onReview}>{review.reviewed ? "Review again" : "Mark day reviewed"}</button></div></>}</>;
}
function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div className={`metric ${accent ? "accent" : ""}`}><small>{label}</small><strong>{value}</strong></div>; }

function Templates({ templates, canCreate, onAdd, onEdit }: { templates: TemplateReadModel[]; canCreate: boolean; onAdd: () => void; onEdit: (template: TemplateReadModel) => void }) { return <><PageHeading eyebrow="Settings and planning" title="More" /><section><div className="section-title"><div><p className="eyebrow">Planning</p><h2>Recurring classes</h2></div><button className="primary compact" disabled={!canCreate} title={canCreate ? undefined : "Add a student first"} onClick={onAdd}>+ New template</button></div><p className="lede">Weekly classes generate scheduled sessions ahead of time.</p>{templates.length ? <div className="template-list">{templates.map((template) => <article className="template-card" key={template.id}><span className="calendar-icon">{template.weekdayLabel.slice(0, 3)}</span><div><h2>{template.studentName}</h2><p>{template.weekdayLabel}{template.nextSessionOn ? ` · Next ${template.nextSessionOn}` : ""}</p><span className={`status ${template.paused ? "canceled" : "held"}`}>{template.paused ? "Paused" : "Active"}</span></div><button className="secondary compact" onClick={() => onEdit(template)} aria-label={`Manage recurring class for ${template.studentName}`}>Manage</button></article>)}</div> : <div className="empty"><b>No recurring classes</b><p>{canCreate ? "Create a weekly template to schedule upcoming sessions." : "Add a student before creating a recurring class."}</p>{canCreate && <button className="primary compact" onClick={onAdd}>Create template</button>}</div>}</section><form action={signOut} className="section"><button className="secondary" type="submit">Sign out</button></form></>;
}

function DialogShell({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = priorOverflow; previouslyFocused?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialog} className="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description"><div className="sheet-handle" /><header><div><p className="eyebrow">Quick action</p><h2 id="dialog-title">{title}</h2><p id="dialog-description">{description}</p></div><button ref={closeButton} type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></header>{children}</section></div>;
}
function BulkDialog({ date, students, selected, setSelected, reviewing, setReviewing, onClose, onConfirm, isPending }: { date: string; students: StudentReadModel[]; selected: string[]; setSelected: (ids: string[]) => void; reviewing: boolean; setReviewing: (value: boolean) => void; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  const selectedStudents = students.filter((student) => selected.includes(student.id));
  const noChangeCount = selectedStudents.filter((student) => student.todaySessionStatus === "held").length;
  const changeCount = selectedStudents.length - noChangeCount;
  const conflictCount = students.filter((student) => student.todaySessionStatus === "canceled" || student.todaySessionStatus === "no_show").length;
  return <DialogShell title={reviewing ? "Review attendance" : "Mark attendance"} description={reviewing ? `Check the changes for ${date} before saving.` : `Choose who attended on ${date}.`} onClose={onClose}>
    {reviewing ? <div className="attendance-review"><div className="review-date"><small>Date</small><strong>{date}</strong></div><div className="review-counts"><span><b>{changeCount}</b><small>Will mark held</small></span><span><b>{noChangeCount}</b><small>No change</small></span><span><b>{conflictCount}</b><small>Needs separate review</small></span></div><ul>{selectedStudents.map((student) => <li key={student.id}><span>{student.name}</span><b>{student.todaySessionStatus === "held" ? "No change" : "Mark held"}</b></li>)}</ul></div> : <><div className="select-tools"><button onClick={() => setSelected(students.filter((student) => student.todaySessionStatus !== "canceled" && student.todaySessionStatus !== "no_show").map((student) => student.id))}>Select available</button><button onClick={() => setSelected([])}>Clear</button></div><div className="check-list">{students.map((student) => { const conflict = student.todaySessionStatus === "canceled" || student.todaySessionStatus === "no_show"; return <label key={student.id} className={conflict ? "conflict" : ""}><input type="checkbox" checked={selected.includes(student.id)} disabled={conflict} onChange={(event) => setSelected(event.target.checked ? [...selected, student.id] : selected.filter((id) => id !== student.id))} /><span><b>{student.name}</b><small>{student.todaySessionStatus === "held" ? "Already held · no change" : conflict ? `${statusLabel(student.todaySessionStatus)} · review separately` : statusLabel(student.todaySessionStatus)}</small></span></label>; })}</div></>}
    <div className="sheet-actions"><button className="secondary" onClick={() => reviewing ? setReviewing(false) : onClose()}>{reviewing ? "Back" : "Cancel"}</button><button className="primary" disabled={!selected.length || isPending} onClick={() => reviewing ? onConfirm() : setReviewing(true)}>{isPending ? "Saving…" : reviewing ? `Mark ${changeCount} attended` : `Review attendance (${selected.length})`}</button></div>
  </DialogShell>;
}
function PaymentDialog({ date, students, selectedStudentId, onClose, onSubmit, isPending }: { date: string; students: StudentReadModel[]; selectedStudentId: string | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; isPending: boolean }) {
  const initialStudent = students.find((student) => student.id === selectedStudentId) ?? students[0];
  const suggestedAmount = ((initialStudent && initialStudent.balanceCents > 0 ? initialStudent.balanceCents : initialStudent?.defaultRateCents ?? 3000) / 100).toFixed(2);
  const [studentId, setStudentId] = useState(initialStudent?.id ?? "");
  const [amount, setAmount] = useState(suggestedAmount);
  const selectedStudent = students.find((student) => student.id === studentId);
  const amountCents = Math.round((Number(amount) || 0) * 100);
  const afterCents = (selectedStudent?.balanceCents ?? 0) - amountCents;
  function selectStudent(nextId: string) {
    const next = students.find((student) => student.id === nextId);
    setStudentId(nextId);
    setAmount(((next && next.balanceCents > 0 ? next.balanceCents : next?.defaultRateCents ?? 3000) / 100).toFixed(2));
  }
  return <DialogShell title="Record payment" description="Review the resulting balance before saving." onClose={onClose}><form onSubmit={onSubmit} className="entry-form"><label>Student<select name="student" value={studentId} onChange={(event) => selectStudent(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {balanceLabel(student)}</option>)}</select></label><label>Amount (BBD)<span className="money-field"><span>$</span><input name="amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></span></label>{selectedStudent && <div className="balance-preview" aria-live="polite"><span><small>Current balance</small><b>{balanceLabel(selectedStudent)}</b></span><span aria-hidden="true">→</span><span><small>Balance after</small><b>{afterCents > 0 ? `Owes ${money(afterCents)}` : afterCents < 0 ? `Credit ${money(afterCents)}` : "Settled"}</b></span></div>}<label>Date<input name="date" type="date" defaultValue={date} required /></label><fieldset><legend>Payment method</legend><div className="segmented">{["Cash", "Transfer", "Other"].map((method) => <label key={method}><input type="radio" name="method" value={method.toLowerCase()} defaultChecked={method === "Cash"} /><span>{method}</span></label>)}</div></fieldset><div className="sheet-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={isPending || !students.length || amountCents <= 0} type="submit">{isPending ? "Saving…" : `Record ${money(amountCents)} payment`}</button></div></form></DialogShell>;
}

function SessionDialog({ date, students, selectedStudentId, onClose, onSubmit, isPending }: { date: string; students: StudentReadModel[]; selectedStudentId: string | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; isPending: boolean }) {
  return <DialogShell title="Log session" description="Record a past, current, or future session. Only held sessions count toward the balance." onClose={onClose}><form onSubmit={onSubmit} className="entry-form"><label htmlFor="session-student">Student</label><select id="session-student" name="student" defaultValue={selectedStudentId ?? students[0]?.id} required>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select><label htmlFor="session-date">Date</label><input id="session-date" name="date" type="date" defaultValue={date} required /><label htmlFor="session-status">Status</label><select id="session-status" name="status" defaultValue="held" required><option value="scheduled">Scheduled</option><option value="held">Held</option><option value="canceled">Canceled</option><option value="no_show">No-show</option></select><div className="sheet-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={isPending || !students.length} type="submit">{isPending ? "Saving…" : "Save session"}</button></div></form></DialogShell>;
}

function StudentDetailDialog({ student, onClose, onPay, onSession, onEdit, onEntry }: { student: StudentReadModel; onClose: () => void; onPay: () => void; onSession: () => void; onEdit: () => void; onEntry: (entry: StudentHistoryEntryReadModel) => void }) {
  return <DialogShell title={student.name} description="Balance, attendance, and payment history in one place." onClose={onClose}>
    <section className={`student-detail-summary ${student.balanceState}`}><small>Current balance</small><strong>{balanceLabel(student)}</strong><div><span><small>Default rate</small><b>{money(student.defaultRateCents ?? 0)}</b></span><span><small>Last attended</small><b>{student.lastAttendedOn ?? "Not yet"}</b></span></div>{student.notes && <p>{student.notes}</p>}</section>
    <div className="student-detail-actions">{!student.archived && <><button className="primary" onClick={onPay}>+ Payment</button><button className="secondary" onClick={onSession}>+ Session</button></>}<button className="text-button" onClick={onEdit}>{student.archived ? "Restore student" : "Edit profile"}</button></div>
    <section className="student-history"><div className="section-title"><div><p className="eyebrow">Ledger</p><h3>History</h3></div><span className="count">{student.history?.length ?? 0}</span></div>{student.history?.length ? <div>{student.history.map((entry) => <button className={`student-history-entry ${entry.voided ? "voided" : ""}`} onClick={() => onEntry(entry)} key={`${entry.kind}-${entry.id}`}><span className={`entry-kind ${entry.kind}`} aria-hidden="true">{entry.kind === "payment" ? "$" : "✓"}</span><span><b>{entry.label}</b><span>{entry.detail}</span><small>{entry.dateLabel}{entry.voided ? " · Voided" : ""}</small></span><span aria-hidden="true">›</span></button>)}</div> : <div className="empty compact-empty"><b>No ledger history yet</b><p>Sessions and payments will appear here.</p></div>}</section>
  </DialogShell>;
}

function EntryDialog({ entry, student, error, onClose, onSubmit, isPending }: { entry: StudentHistoryEntryReadModel; student?: StudentReadModel; error: string | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; isPending: boolean }) {
  const [replacePayment, setReplacePayment] = useState(true);
  const [voidSession, setVoidSession] = useState(false);
  const [amount, setAmount] = useState(((entry.amountCents ?? 0) / 100).toFixed(2));
  const [status, setStatus] = useState<SessionStatus>(entry.status ?? "scheduled");
  const originalEffect = entry.kind === "payment" ? -(entry.amountCents ?? 0) : entry.status === "held" ? entry.chargeRateCents ?? 0 : 0;
  const replacementEffect = entry.kind === "payment" ? replacePayment ? -Math.round((Number(amount) || 0) * 100) : 0 : voidSession ? 0 : status === "held" ? entry.chargeRateCents ?? student?.defaultRateCents ?? 0 : 0;
  const afterBalance = (student?.balanceCents ?? 0) - originalEffect + replacementEffect;
  if (entry.voided) return <DialogShell title={entry.label} description="This immutable ledger entry has already been voided." onClose={onClose}><div className="entry-detail"><p><b>{entry.studentName}</b></p><p>{entry.dateLabel} · {entry.detail}</p>{entry.voidReason && <p className="warning">Reason: {entry.voidReason}</p>}<div className="sheet-actions single"><button className="secondary" onClick={onClose}>Close</button></div></div></DialogShell>;
  return <DialogShell title={entry.kind === "payment" ? "Correct payment" : "Edit session"} description="The original record remains in the audit history." onClose={onClose}><form className="entry-form" onSubmit={onSubmit}>{error && <p className="form-error" role="alert" tabIndex={-1}>{error}</p>}{entry.kind === "payment" ? <><label><span><input name="replacement" type="checkbox" checked={replacePayment} onChange={(event) => setReplacePayment(event.target.checked)} /> Create corrected replacement</span></label>{replacePayment && <><label>Amount (BBD)<span className="money-field"><span>$</span><input name="amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></span></label><label>Date<input name="date" type="date" defaultValue={entry.date} required /></label><label>Method<select name="method" defaultValue={entry.method}><option value="cash">Cash</option><option value="transfer">Transfer</option><option value="other">Other</option></select></label><label>Notes<textarea name="notes" defaultValue={entry.notes ?? ""} rows={2} /></label></>}<label>Reason for correction<textarea name="voidReason" minLength={1} maxLength={500} required rows={2} /></label></> : <><label>Date<input name="date" type="date" defaultValue={entry.date} required /></label><label>Status<select name="status" value={status} onChange={(event) => setStatus(event.target.value as SessionStatus)}><option value="scheduled">Scheduled</option><option value="held">Held</option><option value="canceled">Canceled</option><option value="no_show">No-show</option></select></label><label><span><input name="void" type="checkbox" checked={voidSession} onChange={(event) => setVoidSession(event.target.checked)} /> Void this session</span></label>{voidSession && <label>Reason for voiding<textarea name="voidReason" minLength={1} maxLength={500} required rows={2} /></label>}</>} {student && <div className="balance-preview"><span><small>Current balance</small><b>{balanceLabel(student)}</b></span><span aria-hidden="true">→</span><span><small>Balance after</small><b>{afterBalance > 0 ? `Owes ${money(afterBalance)}` : afterBalance < 0 ? `Credit ${money(afterBalance)}` : "Settled"}</b></span></div>}<div className="sheet-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className={entry.kind === "payment" && !replacePayment || entry.kind === "session" && voidSession ? "danger" : "primary"} disabled={isPending} type="submit">{isPending ? "Saving…" : entry.kind === "payment" ? replacePayment ? "Save correction" : "Void payment" : voidSession ? "Void session" : "Save session changes"}</button></div></form></DialogShell>;
}

function StudentDialog({ student, onClose, onSubmit, onArchive, onRestore, isPending }: { student: StudentReadModel | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onArchive?: () => void; onRestore?: () => void; isPending: boolean }) {
  return <DialogShell title={student?.archived ? "Archived student" : student ? "Manage student" : "Add student"} description={student?.archived ? "History and balances are preserved. Restore this student to resume new attendance." : student ? "Update this student’s rate or notes. Ledger history remains unchanged." : "Add a student to begin logging attendance and payments."} onClose={onClose}><form onSubmit={onSubmit} className="entry-form"><label htmlFor="student-name">Name</label><input id="student-name" name="name" type="text" maxLength={120} defaultValue={student?.name ?? ""} autoComplete="name" required /><label htmlFor="student-rate">Default rate (BBD)</label><span className="money-field"><span>$</span><input id="student-rate" name="rate" type="number" min="0" max="100000" step="0.01" defaultValue={((student?.defaultRateCents ?? 3000) / 100).toFixed(2)} required /></span><label htmlFor="student-notes">Notes (optional)</label><textarea id="student-notes" name="notes" maxLength={5000} defaultValue={student?.notes ?? ""} rows={3} />{student && !student.version && <p className="warning">Refresh the page before editing this student.</p>}<div className="sheet-actions">{onArchive && <button type="button" className="danger" onClick={onArchive}>Archive student</button>}{onRestore && <button type="button" className="primary" disabled={isPending} onClick={onRestore}>{isPending ? "Restoring…" : "Restore student"}</button>}<button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={isPending || Boolean(student && !student.version)} type="submit">{isPending ? "Saving…" : student ? "Save changes" : "Add student"}</button></div></form></DialogShell>;
}

function ArchiveStudentDialog({ student, onClose, onConfirm, isPending }: { student: StudentReadModel; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  return <DialogShell title={`Archive ${student.name}?`} description="They will leave the active roster, but all attendance, payments, balances, and audit history will be preserved." onClose={onClose}><div className="sheet-actions"><button className="secondary" onClick={onClose}>Keep active</button><button className="danger" disabled={isPending} onClick={onConfirm}>{isPending ? "Archiving…" : "Archive student"}</button></div></DialogShell>;
}

const weekdays = [[1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [7, "Sunday"]] as const;
function TemplateDialog({ template, students, defaultDate, onClose, onSubmit, onToggle, onArchive, isPending }: { template: TemplateReadModel | null; students: StudentReadModel[]; defaultDate: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onToggle?: () => void; onArchive?: () => void; isPending: boolean }) {
  const startsOn = template?.startsOn ?? defaultDate;
  const [preview, setPreview] = useState<TemplatePreviewReadModel | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!template || preview) return onSubmit(event);
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPreviewing(true); setPreviewError(null);
    const result = await previewTemplateSchedule({ templateId: template.id, weekday: Number(form.get("weekday")), startsOn: String(form.get("startsOn")), endsOn: String(form.get("endsOn") ?? "") || null, expectedVersion: template.version });
    setPreviewing(false);
    const error = resultMessage(result);
    if (error) return setPreviewError(error);
    if (result.ok) setPreview(result.data as unknown as TemplatePreviewReadModel);
  }
  return <DialogShell title={template ? "Manage recurring class" : "New recurring class"} description={template ? "Review schedule effects before anything changes." : "Create a weekly template and schedule its upcoming sessions."} onClose={onClose}><form onSubmit={handleSubmit} className="entry-form">{previewError && <p className="form-error" role="alert">{previewError}</p>}{template && <input type="hidden" name="student" value={template.studentId} />}{preview && <><input type="hidden" name="weekday" value={preview.newSchedule.weekday} /><input type="hidden" name="startsOn" value={preview.newSchedule.startsOn} /><input type="hidden" name="endsOn" value={preview.newSchedule.endsOn ?? ""} /></>}<label>Student<select name="student" defaultValue={template?.studentId ?? students[0]?.id} disabled={Boolean(template)} required>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>Weekday<select name="weekday" defaultValue={String(template?.weekday ?? 1)} disabled={Boolean(preview)}>{weekdays.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Starts on<input name="startsOn" type="date" defaultValue={startsOn} disabled={Boolean(preview)} required /></label><label>Ends on (optional)<input name="endsOn" type="date" min={startsOn} defaultValue={template?.endsOn ?? ""} disabled={Boolean(preview)} /></label>{preview && <section className="template-preview" aria-live="polite"><p className="eyebrow">Change preview</p><h3>{weekdays.find(([value]) => value === preview.oldSchedule.weekday)?.[1]} → {weekdays.find(([value]) => value === preview.newSchedule.weekday)?.[1]}</h3><dl><div><dt>Affected sessions</dt><dd>{preview.affectedCount}</dd></div><div><dt>Excluded sessions</dt><dd>{preview.excludedCount}</dd></div><div><dt>Conflicts</dt><dd className={preview.conflictCount ? "danger-text" : ""}>{preview.conflictCount}</dd></div></dl><label><span><input type="radio" name="futureMode" value="keep" defaultChecked /> Keep existing sessions</span></label><label><span><input type="radio" name="futureMode" value="update" disabled={preview.conflictCount > 0} /> Update eligible sessions</span></label>{preview.conflictCount > 0 && <p className="form-error">Resolve conflicts before updating eligible sessions.</p>}</section>}{template && !preview && <div className="template-controls"><button type="button" className="secondary" disabled={isPending} onClick={onToggle}>{template.paused ? "Resume recurring class" : "Pause recurring class"}</button><button type="button" className="danger" disabled={isPending} onClick={onArchive}>Archive</button></div>}<div className="sheet-actions"><button type="button" className="secondary" onClick={preview ? () => setPreview(null) : onClose}>{preview ? "Back" : "Cancel"}</button><button className="primary" disabled={isPending || previewing || !students.length} type="submit">{isPending ? "Saving…" : previewing ? "Previewing…" : template ? preview ? "Confirm changes" : "Review changes" : "Create recurring class"}</button></div></form></DialogShell>;
}

function ArchiveTemplateDialog({ template, onClose, onConfirm, isPending }: { template: TemplateReadModel; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  return <DialogShell title="Archive recurring class?" description={`${template.studentName}'s existing sessions and ledger history will remain unchanged.`} onClose={onClose}><div className="sheet-actions"><button className="secondary" onClick={onClose}>Keep class</button><button className="danger" disabled={isPending} onClick={onConfirm}>{isPending ? "Archiving…" : "Archive class"}</button></div></DialogShell>;
}
