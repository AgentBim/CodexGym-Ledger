"use client";

import { useState } from "react";
import { formatLongDate, formatTime } from "@/lib/domain/calendar";
import { formatMoney, packageForSession, remainingClasses } from "@/lib/domain/packages";
import { useApp } from "./context";
import { balanceState, markLabel, type AttendanceMark, type LedgerState, type Student } from "./store";
import { Avatar, BalanceTag, Icon, ListButton, Progress, ScreenHeader } from "./ui";

const stateOrder = { overdue: 0, owes: 1, settled: 2, credit: 3 } as const;

export function rosterOf(state: LedgerState) {
  return state.students.filter((s) => s.enrolled && s.status === "active");
}

function classTime(state: LedgerState) {
  return `${formatTime(state.classSession.start)} – ${formatTime(state.classSession.end)}`;
}

function hasCoverage(state: LedgerState, student: Student) {
  return student.balanceCents < 0 || Boolean(packageForSession(state.studentPackages, student.id, state.classSession.date));
}

export function TodayScreen() {
  const { store: { state }, go } = useApp();
  const [sort, setSort] = useState<"status" | "name">("status");
  const session = state.classSession;
  const roster = rosterOf(state);
  const sorted = [...roster].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : stateOrder[balanceState(a)] - stateOrder[balanceState(b)] || a.name.localeCompare(b.name));
  const overdue = roster.filter((s) => balanceState(s) === "overdue").length;
  const unresolved = roster.filter((s) => balanceState(s) === "owes").length;
  const paidAhead = roster.filter((s) => hasCoverage(state, s)).length;
  const recorded = session.status === "recorded";

  return (
    <>
      <p className="eyebrow">{formatLongDate(session.date)}</p>
      <h1 className="display">Today’s Class</h1>
      <p className="class-time"><b>{classTime(state)}</b> · {session.title}</p>
      <div className="row-between">
        <span className={`chip ${recorded ? "done" : "upcoming"}`}><Icon name={recorded ? "check" : "clock"} size={14} />{recorded ? "Recorded" : "Upcoming"}</span>
        <button className="pill-button" onClick={() => go({ name: "activity", tab: "schedule" })}>View schedule <Icon name="arrowRight" size={15} /></button>
      </div>
      <div className="stat-grid">
        <div className="stat"><b>{roster.length}</b><span>Expected</span></div>
        <div className="stat"><b>{paidAhead}</b><span>Paid ahead</span></div>
        <button className="stat warn" onClick={() => go({ name: "students", filter: "overdue" })}><Icon name="alert" size={18} /><b>{overdue}</b><span>Overdue</span></button>
        <button className="stat" onClick={() => go({ name: "students", filter: "owes" })}><b>{unresolved}</b><span>Unresolved</span></button>
      </div>
      <button className="primary block" onClick={() => go({ name: recorded ? "complete" : "attendance" })}>
        <Icon name={recorded ? "clipboard" : "bulb"} />{recorded ? "View class summary" : "Start class & take attendance"}
      </button>
      <section className="section">
        <div className="section-title">
          <h2>Today’s roster ({roster.length})</h2>
          <label className="sort"><span>Sort:</span><select aria-label="Sort roster" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="status">Status</option><option value="name">Name</option></select></label>
        </div>
        {roster.length === 0 ? <div className="empty"><b>No students in this class yet</b><p>Add students from their profile with “Add to class”.</p></div> : (
          <div className="card-list">
            {sorted.map((student) => {
              const mark = session.marks[student.id];
              return (
                <button key={student.id} className="student-row" onClick={() => go({ name: "student", id: student.id })}>
                  <Avatar name={student.name} />
                  <span className="student-copy"><b>{student.name}</b><BalanceTag student={student} /></span>
                  <span className={`chip small ${mark ?? "scheduled"}`}>{mark ? markLabel[mark] : "Scheduled"}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export function AttendanceScreen() {
  const { store, back, go, openSheet, notify } = useApp();
  const { state } = store;
  const session = state.classSession;
  const roster = rosterOf(state);
  const recorded = session.status === "recorded";
  const markedCount = roster.filter((s) => session.marks[s.id]).length;
  const presentCount = roster.filter((s) => session.marks[s.id] === "present").length;

  function choose(student: Student, mark: AttendanceMark) {
    const current = session.marks[student.id];
    if (current === mark) return store.apply({ type: "mark", studentId: student.id, mark: null });
    const attending = mark !== "absent";
    const wasAttending = current === "present" || current === "late";
    if (attending && !wasAttending && packageForSession(state.studentPackages, student.id, session.date)) {
      return openSheet({ kind: "session", studentId: student.id, mark, fromAttendance: true });
    }
    store.apply({ type: "mark", studentId: student.id, mark });
  }

  return (
    <div className="with-sticky">
      <ScreenHeader title="Mark Attendance" onBack={back} />
      <p className="progress-label"><b>{markedCount} / {roster.length}</b> marked</p>
      <Progress value={markedCount} max={roster.length} label={`${markedCount} of ${roster.length} students marked`} />
      {recorded && <p className="notice"><Icon name="check" size={16} /> This class has been recorded. Use a student’s “Log session” to correct attendance.</p>}
      <div className="card-list attendance-list">
        {roster.map((student) => {
          const pkg = packageForSession(state.studentPackages, student.id, session.date);
          const remaining = pkg ? remainingClasses(pkg) : null;
          return (
            <article key={student.id} className="attendance-card">
              <div className="attendance-who">
                <Avatar name={student.name} />
                <span className="student-copy"><b>{student.name}</b><BalanceTag student={student} />{pkg && <small className="package-note"><Icon name="ticket" size={13} />{pkg.name} · {remaining === null ? "Unlimited" : `${remaining} left`}</small>}</span>
              </div>
              <div className="mark-group" role="group" aria-label={`Attendance for ${student.name}`}>
                {(["present", "late", "absent"] as const).map((mark) => (
                  <button key={mark} className={`mark ${mark}`} aria-pressed={session.marks[student.id] === mark} disabled={recorded} onClick={() => choose(student, mark)}>{markLabel[mark]}</button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      <div className="sticky-action">
        {recorded
          ? <button className="primary block" onClick={() => go({ name: "complete" })}>View class summary</button>
          : <button className="primary block" disabled={markedCount === 0} onClick={() => { store.apply({ type: "completeClass" }, "Class recorded"); notify("Class recorded", true); go({ name: "complete" }); }}>Complete class ({presentCount} present)</button>}
      </div>
    </div>
  );
}

export function ClassCompleteScreen() {
  const { store: { state }, go, notify } = useApp();
  const session = state.classSession;
  const summary = session.summary;
  if (!summary) {
    return <div className="empty"><b>This class hasn’t been recorded yet</b><p>Take attendance first, then complete the class.</p><button className="primary" onClick={() => go({ name: "attendance" })}>Take attendance</button></div>;
  }
  return (
    <>
      <div className="celebrate">
        <span className="confetti" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</span>
        <span className="big-check" aria-hidden="true"><Icon name="check" size={34} /></span>
        <h1>Class recorded!</h1>
        <p>{formatLongDate(session.date)}<br />{classTime(state)}</p>
      </div>
      <section className="summary-card" aria-label="Class summary">
        <div className="summary-row">
          <span><b className="ok">{summary.present}</b>Present</span>
          <span><b className="bad">{summary.absent}</b>Absent</span>
          <span><b className="warn">{summary.late}</b>Late</span>
        </div>
        <div className="summary-row money">
          <span><b className="ok">{formatMoney(summary.collectedCents)}</b>Collected</span>
          <span><b className="bad">{formatMoney(summary.outstandingCents)}</b>Outstanding</span>
        </div>
        {(summary.unmarked > 0 || summary.packagesUsed > 0) && <p className="summary-note">{[summary.packagesUsed > 0 && `${summary.packagesUsed} ${summary.packagesUsed === 1 ? "class" : "classes"} drawn from packages`, summary.unmarked > 0 && `${summary.unmarked} not marked`].filter(Boolean).join(" · ")}</p>}
      </section>
      <section className="section">
        <h2 className="section-heading">Next steps</h2>
        <div className="card-list">
          {summary.outstandingStudents > 0 && <ListButton icon="cash" tone="amber" title="Review outstanding payments" subtitle={`${summary.outstandingStudents} ${summary.outstandingStudents === 1 ? "student" : "students"}`} onClick={() => go({ name: "students", filter: "owing" })} />}
          <ListButton icon="clipboard" tone="amber" title="View class details" onClick={() => go({ name: "attendance" })} />
          {summary.outstandingStudents > 0 && <ListButton icon="bell" tone="blue" title="Send reminder to unpaid" onClick={() => notify("Reminders aren’t connected yet, so no messages were sent.")} />}
        </div>
      </section>
      <button className="primary block spaced" onClick={() => go({ name: "today" })}>Back to Today</button>
    </>
  );
}
