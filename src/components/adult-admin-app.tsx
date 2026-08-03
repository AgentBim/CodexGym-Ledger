"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "today" | "students" | "activity" | "more";
type BalanceState = "overdue" | "owes" | "settled" | "credit";
type Student = { id: string; name: string; balance: number; state: BalanceState; session: "Scheduled" | "Held" | "Canceled" | "No-show"; selected?: boolean };

const seedStudents: Student[] = [
  { id: "maya", name: "Maya Clarke", balance: 6000, state: "overdue", session: "Scheduled", selected: true },
  { id: "joel", name: "Joel Best", balance: -1000, state: "credit", session: "Held", selected: true },
  { id: "ana", name: "Ana Griffith", balance: 0, state: "settled", session: "Canceled" },
  { id: "marcus", name: "Marcus King", balance: 3000, state: "owes", session: "Scheduled", selected: true },
];

const money = (cents: number) => new Intl.NumberFormat("en-BB", { style: "currency", currency: "BBD" }).format(Math.abs(cents) / 100).replace("BBD", "$");
const balanceLabel = (student: Student) => student.state === "credit" ? `Credit ${money(student.balance)}` : student.state === "settled" ? "Settled" : `${student.state === "overdue" ? "Overdue · " : ""}Owes ${money(student.balance)}`;

/** Swap this stateful mock implementation for server data/actions without changing UI props. */
function useMockAdultGymAdapter() {
  const [students, setStudents] = useState(seedStudents);
  const [activities, setActivities] = useState(["Cash payment · Maya · $30.00", "Joel marked held"]);
  const [history, setHistory] = useState<{ students: Student[]; activities: string[] }[]>([]);
  return {
    students,
    activities,
    markHeld(ids: string[]) {
      setHistory((current) => [{ students, activities }, ...current]);
      setStudents((current) => current.map((student) => ids.includes(student.id) ? { ...student, session: "Held" } : student));
      setActivities((current) => [`${ids.length} students marked held`, ...current]);
    },
    recordPayment(studentId: string, amount: number) {
      setHistory((current) => [{ students, activities }, ...current]);
      setStudents((current) => current.map((student) => student.id === studentId ? { ...student, balance: student.balance - amount, state: student.balance - amount < 0 ? "credit" : student.balance - amount === 0 ? "settled" : student.state === "overdue" ? "overdue" : "owes" } : student));
      const name = students.find((student) => student.id === studentId)?.name ?? "Student";
      setActivities((current) => [`Payment · ${name} · ${money(amount)}`, ...current]);
    },
    undoLast() {
      const previous = history[0];
      if (!previous) return false;
      setStudents(previous.students);
      setActivities(previous.activities);
      setHistory((current) => current.slice(1));
      return true;
    },
  };
}

export function AdultAdminApp() {
  const data = useMockAdultGymAdapter();
  const [view, setView] = useState<View>("today");
  const [modal, setModal] = useState<"bulk" | "payment" | "confirm" | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | BalanceState>("all");
  const [selected, setSelected] = useState<string[]>(seedStudents.filter((s) => s.selected).map((s) => s.id));
  const [undo, setUndo] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const filtered = useMemo(() => data.students.filter((student) => student.name.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || student.state === filter)), [data.students, filter, query]);

  useEffect(() => {
    if (!undo) return;
    const timeout = window.setTimeout(() => setUndo(null), 10 * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, [undo]);

  function confirmBulk() {
    data.markHeld(selected);
    setModal(null);
    setUndo(`${selected.length} students marked held`);
  }

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get("student"));
    const amount = Math.round(Number(form.get("amount")) * 100);
    data.recordPayment(studentId, amount);
    setModal(null);
    setUndo(`Payment of ${money(amount)} recorded`);
  }

  return (
    <div className="app-frame">
      <aside className="side-nav" aria-label="Primary navigation"><Brand />{navItems.map((item) => <NavButton key={item.id} item={item} view={view} setView={setView} />)}</aside>
      <div className="app-content">
        <header className="topbar"><Brand /><span className="save-state"><i /> All changes saved</span></header>
        <main id="main-content" className="main-content">
          {view === "today" && <Today students={data.students} activities={data.activities} onBulk={() => setModal("bulk")} onPay={() => setModal("payment")} />}
          {view === "students" && <Students students={filtered} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onPay={() => setModal("payment")} />}
          {view === "activity" && <Activity reviewed={reviewed} onReview={() => { setReviewed(true); setUndo("Day marked reviewed"); }} />}
          {view === "more" && <Templates onConfirm={() => setModal("confirm")} />}
        </main>
        <nav className="bottom-nav" aria-label="Primary navigation">{navItems.map((item) => <NavButton key={item.id} item={item} view={view} setView={setView} />)}</nav>
      </div>
      {modal === "bulk" && <BulkDialog students={data.students} selected={selected} setSelected={setSelected} onClose={() => setModal(null)} onConfirm={confirmBulk} />}
      {modal === "payment" && <PaymentDialog students={data.students} onClose={() => setModal(null)} onSubmit={submitPayment} />}
      {modal === "confirm" && <ConfirmDialog onClose={() => setModal(null)} onConfirm={() => { setModal(null); setUndo("Template paused"); }} />}
      {undo && <div className="undo-toast" role="status"><span>{undo}<small>Undo available for 10 minutes</small></span><button onClick={() => { const restored = data.undoLast(); setUndo(restored ? "Last action undone" : null); }}>Undo</button><button aria-label="Dismiss notification" onClick={() => setUndo(null)}>×</button></div>}
    </div>
  );
}

const navItems: { id: View; label: string; icon: string }[] = [{ id: "today", label: "Today", icon: "⌂" }, { id: "students", label: "Students", icon: "♙" }, { id: "activity", label: "Activity", icon: "≋" }, { id: "more", label: "More", icon: "•••" }];
function Brand() { return <div className="brand"><span className="brand-mark">A</span><span><b>Adult Gym</b><small>Class admin</small></span></div>; }
function NavButton({ item, view, setView }: { item: typeof navItems[number]; view: View; setView: (v: View) => void }) { return <button className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>; }

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</header>; }
function Balance({ student }: { student: Student }) { return <span className={`balance ${student.state}`}><span aria-hidden="true">{student.state === "overdue" ? "▲" : student.state === "credit" ? "↓" : student.state === "settled" ? "✓" : "○"}</span>{balanceLabel(student)}</span>; }
function Status({ value }: { value: Student["session"] }) { return <span className={`status ${value.toLowerCase().replace("-", "")}`}>{value}</span>; }

function Today({ students, activities, onBulk, onPay }: { students: Student[]; activities: string[]; onBulk: () => void; onPay: () => void }) {
  return <><PageHeading eyebrow="Friday, 31 July" title="Today"><button className="icon-button" aria-label="Open notifications">●<span className="notification-dot" /></button></PageHeading>
    <button className="alert-card"><span aria-hidden="true">!</span><b>1 student is overdue</b><small>View outstanding balances →</small></button>
    <section className="section"><div className="section-title"><div><p className="eyebrow">Today’s class</p><h2>4 students</h2></div><button className="secondary" onClick={onPay}>+ Payment</button></div>
      <div className="student-list">{students.map((student) => <article className="student-row" key={student.id}><div className="avatar" aria-hidden="true">{student.name.split(" ").map((p) => p[0]).join("")}</div><div className="student-copy"><strong>{student.name}</strong><Balance student={student} /></div><Status value={student.session} /></article>)}</div>
    </section>
    <section className="section recent"><div className="section-title"><h2>Recent activity</h2><button className="text-button">View all</button></div>{activities.slice(0, 3).map((activity, i) => <div className="activity-row" key={`${activity}-${i}`}><span className="activity-icon">✓</span><span>{activity}<small>{i === 0 ? "Just now" : "18 min ago"}</small></span></div>)}</section>
    <div className="sticky-action"><button className="primary" onClick={onBulk}><span aria-hidden="true">✓</span> Mark class attended</button></div></>;
}

function Students({ students, query, setQuery, filter, setFilter, onPay }: { students: Student[]; query: string; setQuery: (s: string) => void; filter: "all" | BalanceState; setFilter: (s: "all" | BalanceState) => void; onPay: () => void }) {
  return <><PageHeading eyebrow="Roster" title="Students"><button className="primary compact">+ Add student</button></PageHeading><div className="search-row"><label className="search"><span>⌕</span><span className="sr-only">Search students</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" /></label><select aria-label="Filter by balance" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">All balances</option><option value="overdue">Overdue</option><option value="owes">Owes</option><option value="settled">Settled</option><option value="credit">Credit</option></select></div><p className="result-count">{students.length} students</p><div className="student-grid">{students.map((student) => <article className="profile-card" key={student.id}><div className="avatar">{student.name[0]}</div><div><h2>{student.name}</h2><Balance student={student} /><p>Last attended 24 Jul</p></div><button className="secondary" onClick={onPay}>Pay</button></article>)}</div>{students.length === 0 && <div className="empty"><b>No matching students</b><p>Try clearing your search or balance filter.</p></div>}</>;
}

function Activity({ reviewed, onReview }: { reviewed: boolean; onReview: () => void }) {
  return <><PageHeading eyebrow="End-of-day review" title="Recap"><label className="date-control"><span className="sr-only">Recap date</span><input type="date" defaultValue="2026-07-31" /></label></PageHeading><div className={`review-state ${reviewed ? "done" : ""}`}><span>{reviewed ? "✓" : "○"}</span><div><b>{reviewed ? "Reviewed" : "Not reviewed yet"}</b><small>{reviewed ? "You can review again after later changes." : "Check today’s entries before wrapping up."}</small></div></div><section className="metric-grid"><Metric label="Held" value="3" /><Metric label="No-show" value="0" /><Metric label="Collected" value="$180" accent /><Metric label="Still scheduled" value="1" /></section><section className="summary-card"><p className="eyebrow">July summary · BBD</p><div><span><small>Total owed</small><b>$90.00</b></span><span><small>Total credit</small><b>$10.00</b></span><span><small>Attendance</small><b>26</b></span></div></section><section className="section"><div className="section-title"><h2>Needs attention</h2><span className="count">2</span></div><div className="warning"><b>1 session still scheduled</b><p>Confirm whether Marcus attended today.</p><button>Review session →</button></div><div className="warning cool"><b>1 overdue balance</b><p>Maya owes $60.00 from prior classes.</p><button>View balance →</button></div></section><div className="sticky-action"><button className="primary" onClick={onReview}>{reviewed ? "Review again" : "Mark day reviewed"}</button></div></>;
}
function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div className={`metric ${accent ? "accent" : ""}`}><small>{label}</small><strong>{value}</strong></div>; }

function Templates({ onConfirm }: { onConfirm: () => void }) { return <><PageHeading eyebrow="Planning" title="Recurring classes"><button className="primary compact">+ New template</button></PageHeading><p className="lede">Weekly classes generate scheduled sessions for the next 12 weeks.</p><div className="template-list">{[["Maya Clarke", "Mondays", "3 Aug"], ["Joel Best", "Fridays", "7 Aug"]].map(([name, day, next]) => <article className="template-card" key={name}><span className="calendar-icon">{day.slice(0, 3)}</span><div><h2>{name}</h2><p>{day} · Next {next}</p><span className="status held">Active</span></div><button className="icon-button" aria-label={`Manage ${name} template`} onClick={onConfirm}>•••</button></article>)}</div></>;
}

function DialogShell({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description"><div className="sheet-handle" /><header><div><p className="eyebrow">Quick action</p><h2 id="dialog-title">{title}</h2><p id="dialog-description">{description}</p></div><button ref={closeButton} type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></header>{children}</section></div>;
}
function BulkDialog({ students, selected, setSelected, onClose, onConfirm }: { students: Student[]; selected: string[]; setSelected: (ids: string[]) => void; onClose: () => void; onConfirm: () => void }) { return <DialogShell title="Mark class attended" description="Selected students will be marked held for 31 July."><div className="select-tools"><button onClick={() => setSelected(students.filter((s) => s.session !== "Canceled").map((s) => s.id))}>Select available</button><button onClick={() => setSelected([])}>Clear</button></div><div className="check-list">{students.map((student) => <label key={student.id} className={student.session === "Canceled" ? "conflict" : ""}><input type="checkbox" checked={selected.includes(student.id)} disabled={student.session === "Canceled"} onChange={(e) => setSelected(e.target.checked ? [...selected, student.id] : selected.filter((id) => id !== student.id))} /><span><b>{student.name}</b><small>{student.session === "Held" ? "Already held · no change" : student.session === "Canceled" ? "Canceled · review separately" : student.session}</small></span></label>)}</div><div className="sheet-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={!selected.length} onClick={onConfirm}>Confirm {selected.length} attended</button></div></DialogShell>; }
function PaymentDialog({ students, onClose, onSubmit }: { students: Student[]; onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) { return <DialogShell title="Record payment" description="Payment is confirmed only after it is saved."><form onSubmit={onSubmit} className="entry-form"><label>Student<select name="student" defaultValue="maya">{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {balanceLabel(student)}</option>)}</select></label><label>Amount (BBD)<span className="money-field"><span>$</span><input name="amount" type="number" min="0.01" step="0.01" defaultValue="30.00" required /></span></label><label>Date<input name="date" type="date" defaultValue="2026-07-31" required /></label><fieldset><legend>Payment method</legend><div className="segmented">{["Cash", "Transfer", "Other"].map((method) => <label key={method}><input type="radio" name="method" value={method.toLowerCase()} defaultChecked={method === "Cash"} /><span>{method}</span></label>)}</div></fieldset><div className="sheet-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit">Record payment</button></div></form></DialogShell>; }
function ConfirmDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) { return <DialogShell title="Pause Maya’s template?" description="Future generation will stop. Existing held and scheduled sessions remain unchanged."><div className="sheet-actions"><button className="secondary" autoFocus onClick={onClose}>Keep active</button><button className="danger" onClick={onConfirm}>Pause template</button></div></DialogShell>; }
