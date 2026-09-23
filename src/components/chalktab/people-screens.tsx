"use client";

import { useMemo, useState } from "react";
import { addWeeks, formatDate, formatEventTime, formatMonthYear, formatShortDate, formatTime, weekdayPlural } from "@/lib/domain/calendar";
import { formatMoney, remainingClasses, studentPackageStatus } from "@/lib/domain/packages";
import { rosterOf } from "./class-screens";
import { useApp, type ActivityTab, type StudentFilter, type StudentTab } from "./context";
import { balanceState, type ActivityEvent, type EventKind, type LedgerState } from "./store";
import { Avatar, BalanceTag, Icon, PackageUsage, ScreenHeader, Tabs, type IconName } from "./ui";

const eventStyle: Record<EventKind, { icon: IconName; tone: string; label: string }> = {
  payment: { icon: "cash", tone: "brand", label: "Payments" },
  attendance: { icon: "clipboard", tone: "blue", label: "Attendance" },
  student: { icon: "user", tone: "slate", label: "Students" },
  schedule: { icon: "calendar", tone: "brand", label: "Schedule" },
  void: { icon: "ban", tone: "red", label: "Voids" },
  package: { icon: "package", tone: "amber", label: "Packages" },
  adjustment: { icon: "sliders", tone: "slate", label: "Adjustments" },
};

function EventCard({ event, today }: { event: ActivityEvent; today: string }) {
  const style = eventStyle[event.kind];
  return (
    <article className="event">
      <span className={`tile-icon ${style.tone}`}><Icon name={style.icon} /></span>
      <div>
        <b>{event.title}</b>
        <span>{event.subject}</span>
        <span>{event.detail}</span>
        <small>{formatEventTime(event.date, event.time, today)}{event.actor !== "Coach" ? ` · By ${event.actor}` : ""}</small>
      </div>
    </article>
  );
}

export function ActivityScreen({ initialTab = "timeline" }: { initialTab?: ActivityTab }) {
  const { store: { state } } = useApp();
  const [tab, setTab] = useState<ActivityTab>(initialTab);
  const [student, setStudent] = useState("all");
  const [kind, setKind] = useState<"all" | EventKind>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const events = state.events.filter((e) => (student === "all" || e.studentId === student) && (kind === "all" || e.kind === kind) && (!from || e.date >= from) && (!to || e.date <= to));
  const filtered = student !== "all" || kind !== "all" || from || to;

  return (
    <>
      <p className="eyebrow">Activity</p>
      <Tabs label="Activity views" variant="solid" value={tab} onChange={setTab} tabs={[{ id: "timeline", label: "Timeline" }, { id: "schedule", label: "Schedule" }, { id: "audit", label: "Audit log" }]} />
      {tab === "schedule" ? <Schedule state={state} /> : (
        <>
          <div className="filters">
            <select aria-label="Filter by student" value={student} onChange={(e) => setStudent(e.target.value)}><option value="all">All students</option>{state.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="all">All types</option>{(Object.keys(eventStyle) as EventKind[]).map((k) => <option key={k} value={k}>{eventStyle[k].label}</option>)}</select>
            <label className="field compact"><span className="field-label">From</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field compact"><span className="field-label">To</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          {filtered && <button className="text-button" onClick={() => { setStudent("all"); setKind("all"); setFrom(""); setTo(""); }}>Clear filters</button>}
          {events.length === 0 ? <div className="empty"><b>No activity matches</b><p>Try a wider date range or clear the filters.</p></div>
            : tab === "timeline" ? <div className="card-list events">{events.map((e) => <EventCard key={e.id} event={e} today={state.today} />)}</div>
              : (
                <table className="audit">
                  <thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">By</th></tr></thead>
                  <tbody>{events.map((e) => <tr key={e.id}><td>{formatShortDate(e.date)}<small>{formatTime(e.time)}</small></td><td><b>{e.title}</b><small>{e.subject} · {e.detail}</small></td><td>{e.actor}</td></tr>)}</tbody>
                </table>
              )}
        </>
      )}
    </>
  );
}

function Schedule({ state }: { state: LedgerState }) {
  const session = state.classSession;
  const upcoming = Array.from({ length: 6 }, (_, i) => addWeeks(session.date, i));
  const size = rosterOf(state).length;
  return (
    <>
      <div className="info-card"><span className="tile-icon brand"><Icon name="repeat" /></span><div><b>{session.title}</b><span>{weekdayPlural(session.date)} · {formatTime(session.start)} – {formatTime(session.end)}</span><small>{size} {size === 1 ? "student" : "students"} enrolled</small></div></div>
      <h2 className="section-heading">Upcoming classes</h2>
      <div className="card-list">
        {upcoming.map((date, i) => (
          <article className="event" key={date}>
            <span className="tile-icon slate"><Icon name="calendar" /></span>
            <div><b>{formatDate(date)}</b><span>{formatTime(session.start)} · {session.title}</span><small>{i === 0 ? (session.status === "recorded" ? "Recorded today" : "Today") : "Scheduled"}</small></div>
          </article>
        ))}
      </div>
    </>
  );
}

const filterLabels: Record<StudentFilter, string> = { all: "All active", overdue: "Overdue", owes: "Owes (not overdue)", owing: "Owes anything", settled: "Settled", credit: "Credit", archived: "Archived" };

export function StudentsScreen({ initialFilter = "all" }: { initialFilter?: StudentFilter }) {
  const { store: { state }, go, openSheet } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StudentFilter>(initialFilter);
  const results = useMemo(() => state.students
    .filter((s) => (filter === "archived" ? s.status === "archived" : s.status === "active"))
    .filter((s) => {
      const b = balanceState(s);
      if (filter === "all" || filter === "archived") return true;
      if (filter === "owing") return s.balanceCents > 0;
      return b === filter;
    })
    .filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.name.localeCompare(b.name)), [filter, query, state.students]);

  return (
    <>
      <div className="row-between"><h1 className="title">Students</h1><button className="secondary compact" onClick={() => openSheet({ kind: "payment" })}><Icon name="cash" /> Record payment</button></div>
      <div className="search-row">
        <label className="search"><Icon name="users" /><span className="sr-only">Search students</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" /></label>
        <select aria-label="Filter students" value={filter} onChange={(e) => setFilter(e.target.value as StudentFilter)}>{(Object.keys(filterLabels) as StudentFilter[]).map((f) => <option key={f} value={f}>{filterLabels[f]}</option>)}</select>
      </div>
      <p className="result-count" aria-live="polite">{results.length} {results.length === 1 ? "student" : "students"}</p>
      {results.length === 0 ? <div className="empty"><b>No matching students</b><p>Clear the search or choose another filter.</p><button className="secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button></div> : (
        <div className="card-list">
          {results.map((s) => (
            <button key={s.id} className="student-row" onClick={() => go({ name: "student", id: s.id })}>
              <Avatar name={s.name} />
              <span className="student-copy"><b>{s.name}</b><BalanceTag student={s} /></span>
              {s.status === "archived" ? <span className="chip small">Archived</span> : s.enrolled ? <span className="chip small scheduled">In class</span> : null}
              <Icon name="chevron" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function StudentProfileScreen({ studentId, initialTab = "overview" }: { studentId: string; initialTab?: StudentTab }) {
  const { store, back, go, openSheet, notify } = useApp();
  const { state } = store;
  const [tab, setTab] = useState<StudentTab>(initialTab);
  const student = state.students.find((s) => s.id === studentId);
  const [notes, setNotes] = useState(student?.notes ?? "");
  if (!student) return <div className="empty"><b>Student not found</b><button className="secondary" onClick={back}>Go back</button></div>;

  const archived = student.status === "archived";
  const events = state.events.filter((e) => e.studentId === student.id);
  const payments = events.filter((e) => e.kind === "payment" || e.kind === "void");
  const packages = state.studentPackages.filter((p) => p.studentId === student.id);
  const active = packages.filter((p) => ["active", "upcoming"].includes(studentPackageStatus(p, state.today)));
  const past = packages.filter((p) => !active.includes(p));
  const addPackage = () => go({ name: "assign", studentId: student.id });

  return (
    <>
      <ScreenHeader title="" onBack={back}><button className="secondary compact" onClick={() => openSheet({ kind: "edit", studentId: student.id })}>Edit</button></ScreenHeader>
      <div className="profile-head">
        <Avatar name={student.name} large />
        <div>
          <h1 className="title">{student.name}</h1>
          <span className={`status-dot ${archived ? "archived" : ""}`}>{archived ? "Archived" : "Active"}</span>
          <small>Member since {formatMonthYear(student.memberSince)}</small>
        </div>
      </div>
      <Tabs label="Student sections" value={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "history", label: "History" }, { id: "payments", label: "Payments" }, { id: "packages", label: "Packages" }, { id: "notes", label: "Notes" }]} />

      {tab === "overview" && (
        <>
          <section className="panel balance-panel">
            <div><small>Account balance</small><BalanceTag student={student} /></div>
            <button className="primary compact" onClick={() => openSheet({ kind: "payment", studentId: student.id })}>Record payment</button>
          </section>
          {!archived && (
            <section className="section">
              <h2 className="section-heading">Quick actions</h2>
              <div className="quick-grid">
                <button className="quick" onClick={() => openSheet({ kind: "session", studentId: student.id })}><Icon name="clock" />Log session</button>
                <button className="quick" onClick={() => openSheet({ kind: "adjust", studentId: student.id })}><Icon name="sliders" />Adjust balance</button>
                <button className="quick" onClick={() => { store.apply({ type: "toggleEnrolled", studentId: student.id }, "Class list updated"); notify(student.enrolled ? `${student.name} removed from ${state.classSession.title}` : `${student.name} added to ${state.classSession.title}`, true); }}><Icon name={student.enrolled ? "minus" : "userPlus"} />{student.enrolled ? "Remove from class" : "Add to class"}</button>
                <button className="quick" onClick={() => openSheet({ kind: "archive", studentId: student.id })}><Icon name="archive" />Archive student</button>
              </div>
            </section>
          )}
          <section className="section panel">
            <h2 className="section-heading">Packages &amp; credits</h2>
            {active[0] ? <PackageCard pkgId={active[0].id} state={state} /> : <p className="muted">No active package. Sessions are charged at {formatMoney(student.rateCents)}.</p>}
            {!archived && <button className="outline block" onClick={addPackage}><Icon name="plus" /> Add package / credit</button>}
          </section>
          <section className="section">
            <div className="section-title"><h2>Recent activity</h2>{events.length > 3 && <button className="text-button" onClick={() => setTab("history")}>View all</button>}</div>
            <EventList events={events.slice(0, 3)} today={state.today} empty="No activity yet." />
          </section>
        </>
      )}
      {tab === "history" && <EventList events={events} today={state.today} empty="No history yet." />}
      {tab === "payments" && <EventList events={payments} today={state.today} empty="No payments recorded." />}
      {tab === "packages" && (
        <>
          <h2 className="section-heading">Active packages</h2>
          {active.length ? <div className="card-list">{active.map((p) => <PackageCard key={p.id} pkgId={p.id} state={state} />)}</div> : <p className="muted">No active packages.</p>}
          {!archived && <button className="outline block" onClick={addPackage}><Icon name="plus" /> Add package</button>}
          {past.length > 0 && <><h2 className="section-heading">Past packages</h2><div className="card-list">{past.map((p) => <PackageCard key={p.id} pkgId={p.id} state={state} />)}</div></>}
        </>
      )}
      {tab === "notes" && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); store.apply({ type: "saveNotes", studentId: student.id, notes }, "Notes saved"); notify("Notes saved"); }}>
          <label className="field"><span className="field-label">Coach notes</span><textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Injuries, goals, contact preferences…" /></label>
          <button className="primary block" type="submit" disabled={notes === student.notes}>Save notes</button>
        </form>
      )}
    </>
  );
}

function EventList({ events, today, empty }: { events: ActivityEvent[]; today: string; empty: string }) {
  return events.length ? <div className="card-list events">{events.map((e) => <EventCard key={e.id} event={e} today={today} />)}</div> : <p className="muted">{empty}</p>;
}

function PackageCard({ pkgId, state }: { pkgId: string; state: LedgerState }) {
  const pkg = state.studentPackages.find((p) => p.id === pkgId);
  if (!pkg) return null;
  const status = studentPackageStatus(pkg, state.today);
  const remaining = remainingClasses(pkg);
  const ended = status === "expired" || status === "used_up";
  return (
    <article className={`package-card${ended ? " past" : ""}`}>
      <b>{pkg.name}</b>
      <PackageUsage pkg={pkg} />
      {!ended && <p className="remaining">{remaining === null ? "Unlimited classes" : `${remaining} remaining`}</p>}
      <small>
        {status === "expired" && pkg.endDate ? `Expired ${formatDate(pkg.endDate)}`
          : status === "used_up" ? `All classes used${pkg.endDate ? ` · valid until ${formatDate(pkg.endDate)}` : ""}`
            : `${status === "upcoming" ? "Starts " : ""}${formatShortDate(pkg.startDate)} – ${pkg.endDate ? formatDate(pkg.endDate) : "no expiry"}`}
      </small>
    </article>
  );
}
