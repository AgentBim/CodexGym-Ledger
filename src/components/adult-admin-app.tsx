"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type View = "today" | "students" | "activity" | "more";
type BalanceState = "overdue" | "settled" | "credit";
type SessionStatus = "scheduled" | "held" | "noshow" | "canceled";
type ClassGroup = "Adult Beginner" | "Adult Intermediate";

type Student = {
  id: string;
  name: string;
  schedule: string;
  classGroup: ClassGroup;
  balance: number;
  balanceState: BalanceState;
  session: SessionStatus;
  scheduledToday: boolean;
  preCanceled?: boolean;
};

type ActivityEntry = { id: string; icon: IconName; tone: "brand" | "ink" | "danger" | "warn"; text: ReactNode; time: string };

const seedStudents: Student[] = [
  { id: "marcus", name: "Marcus Webb", schedule: "Tue/Thu · Adult Beginner", classGroup: "Adult Beginner", balance: 6000, balanceState: "overdue", session: "scheduled", scheduledToday: true },
  { id: "dana", name: "Dana Kim", schedule: "Mon/Wed · Adult Beginner", classGroup: "Adult Beginner", balance: 3000, balanceState: "overdue", session: "scheduled", scheduledToday: false },
  { id: "rosa", name: "Rosa Petrov", schedule: "Tue/Thu · Adult Beginner", classGroup: "Adult Beginner", balance: 9000, balanceState: "overdue", session: "scheduled", scheduledToday: false },
  { id: "joel", name: "Joel Ramirez", schedule: "Mon/Wed · Adult Intermediate", classGroup: "Adult Intermediate", balance: 0, balanceState: "settled", session: "scheduled", scheduledToday: true },
  { id: "priya", name: "Priya Shah", schedule: "Tue/Thu · Adult Intermediate", classGroup: "Adult Intermediate", balance: -1000, balanceState: "credit", session: "scheduled", scheduledToday: true },
  { id: "ana", name: "Ana Griffith", schedule: "Tue/Thu · Adult Beginner", classGroup: "Adult Beginner", balance: 0, balanceState: "settled", session: "canceled", scheduledToday: true, preCanceled: true },
];

const seedActivity: ActivityEntry[] = [
  { id: "a1", icon: "check", tone: "brand", text: <>Marked <b>Joel Ramirez</b> attended</>, time: "6:04 PM" },
  { id: "a2", icon: "payment", tone: "ink", text: <>Logged <b>$30</b> payment for Dana Kim</>, time: "5:48 PM" },
  { id: "a3", icon: "cancel", tone: "danger", text: <>Marked <b>Ana Griffith</b> canceled</>, time: "4:12 PM" },
];

const money = (cents: number) => new Intl.NumberFormat("en-BB", { style: "currency", currency: "BBD" }).format(Math.abs(cents) / 100).replace("BBD", "$");
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");
const balanceLabel = (student: Student) => student.balanceState === "credit" ? `Credit ${money(student.balance)}` : student.balanceState === "settled" ? "Paid up" : `Overdue · Owes ${money(student.balance)}`;

type IconName =
  | "today" | "students" | "activity" | "more" | "search" | "filters" | "check" | "warnTriangle" | "cancel"
  | "payment" | "profile" | "close" | "offline" | "info" | "duplicate" | "signout" | "chevronRight" | "chevronLeft" | "alert";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    today: <path d="M4 11.5 12 4l8 7.5M6 10v9.5a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    students: <><circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth="2" /><path d="M2.5 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="17" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="2" /><path d="M14.7 20a5.3 5.3 0 0 1 7.8-4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    more: <><circle cx="6" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="18" cy="12" r="1.7" fill="currentColor" /></>,
    search: <><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
    filters: <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    check: <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
    warnTriangle: <><path d="M12 4l9 16H3L12 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
    cancel: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
    payment: <path d="M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5s-5 1.4-5 3.2c0 1.9 1.8 2.8 5 3.3 3.2.5 5 1.4 5 3.3 0 1.8-2.2 3.2-5 3.2s-5-1.6-5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    profile: <><circle cx="12" cy="8" r="3.3" stroke="currentColor" strokeWidth="2" /><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
    offline: <><path d="M3 8.5c5-4 13-4 18 0M6.2 12c3.6-2.7 8-2.7 11.6 0M9.5 15.5c1.8-1.3 3.2-1.3 5 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="19" r="1.1" fill="currentColor" /></>,
    info: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
    duplicate: <><rect x="4" y="7" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="2" /></>,
    signout: <><path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 12h11M17 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>,
    chevronRight: <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
    chevronLeft: <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
    alert: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">{paths[name]}</svg>;
}

/** Swap this stateful mock implementation for server data/actions without changing UI props. */
function useMockLedgerAdapter() {
  const [students, setStudents] = useState(seedStudents);
  const [activity, setActivity] = useState(seedActivity);
  const [history, setHistory] = useState<{ students: Student[]; activity: ActivityEntry[] }[]>([]);

  function commit(next: Student[], entry: ActivityEntry) {
    setHistory((current) => [{ students, activity }, ...current]);
    setStudents(next);
    setActivity((current) => [entry, ...current]);
  }

  function setStatus(id: string, session: SessionStatus, icon: IconName, tone: ActivityEntry["tone"], verb: string) {
    const student = students.find((s) => s.id === id);
    if (!student) return;
    commit(
      students.map((s) => (s.id === id ? { ...s, session } : s)),
      { id: `${Date.now()}`, icon, tone, text: <>Marked <b>{student.name}</b> {verb}</>, time: "Just now" },
    );
  }

  return {
    students,
    activity,
    markAttended: (id: string) => setStatus(id, "held", "check", "brand", "attended"),
    markNoShow: (id: string) => setStatus(id, "noshow", "warnTriangle", "warn", "no-show"),
    cancelClass: (id: string) => setStatus(id, "canceled", "cancel", "danger", "canceled"),
    confirmBulk: (ids: string[]) => {
      commit(
        students.map((s) => (ids.includes(s.id) ? { ...s, session: "held" } : s)),
        { id: `${Date.now()}`, icon: "check", tone: "brand", text: <>Marked <b>{ids.length} students</b> attended</>, time: "Just now" },
      );
    },
    recordPayment: (id: string, amountCents: number) => {
      const student = students.find((s) => s.id === id);
      if (!student) return;
      const nextBalance = student.balance - amountCents;
      commit(
        students.map((s) => (s.id === id ? { ...s, balance: nextBalance, balanceState: nextBalance < 0 ? "credit" : nextBalance === 0 ? "settled" : s.balanceState } : s)),
        { id: `${Date.now()}`, icon: "payment", tone: "ink", text: <>Logged <b>{money(amountCents)}</b> payment for {student.name}</>, time: "Just now" },
      );
    },
    undoLast() {
      const previous = history[0];
      if (!previous) return false;
      setStudents(previous.students);
      setActivity(previous.activity);
      setHistory((current) => current.slice(1));
      return true;
    },
  };
}

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useOnlineStatus() {
  return useSyncExternalStore(subscribeToConnectivity, () => !navigator.onLine, () => false);
}

export function AdultAdminApp() {
  const data = useMockLedgerAdapter();
  const offline = useOnlineStatus();
  const [view, setView] = useState<View>("today");
  const [query, setQuery] = useState("");
  const [balanceFilters, setBalanceFilters] = useState<BalanceState[]>(["overdue"]);
  const [classFilters, setClassFilters] = useState<ClassGroup[]>(["Adult Beginner"]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickActionId, setQuickActionId] = useState<string | null>(null);
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timeout = window.setTimeout(() => setUndo(null), 10 * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, [undo]);

  const today = useMemo(() => data.students.filter((s) => s.scheduledToday), [data.students]);
  const stagedCount = today.filter((s) => s.session === "scheduled" && !s.preCanceled).length;
  const totalToday = today.length;

  const filteredRoster = useMemo(
    () => data.students.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) &&
      (balanceFilters.length === 0 || balanceFilters.includes(s.balanceState)) &&
      (classFilters.length === 0 || classFilters.includes(s.classGroup))),
    [data.students, query, balanceFilters, classFilters],
  );

  function toggleFilter<T>(list: T[], setList: (next: T[]) => void, value: T) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function confirmBulk() {
    const ids = today.filter((s) => s.session === "scheduled" && !s.preCanceled).map((s) => s.id);
    data.confirmBulk(ids);
    setUndo(`${ids.length} students marked attended`);
  }

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get("student"));
    const amount = Math.round(Number(form.get("amount")) * 100);
    data.recordPayment(studentId, amount);
    setPaymentFor(null);
    setUndo(`Payment of ${money(amount)} recorded`);
  }

  const quickActionStudent = today.find((s) => s.id === quickActionId) ?? null;

  return (
    <div className="app-frame">
      <aside className="side-nav" aria-label="Primary navigation"><Brand /><NavButtons view={view} setView={setView} /></aside>
      <div className="app-content">
        <header className="topbar">
          <Brand />
          <span className={`save-state${offline ? " offline" : ""}`}><i />{offline ? "Offline — changes will sync later" : "All changes saved"}</span>
        </header>
        <main id="main-content" className="main-content">
          {view === "today" && (
            <Today
              students={today}
              stagedCount={stagedCount}
              totalToday={totalToday}
              offline={offline}
              onOpenRow={setQuickActionId}
              onConfirmBulk={confirmBulk}
            />
          )}
          {view === "students" && (
            <Students
              students={filteredRoster}
              total={data.students.length}
              query={query}
              setQuery={setQuery}
              balanceFilters={balanceFilters}
              classFilters={classFilters}
              onRemoveBalanceFilter={(v) => toggleFilter(balanceFilters, setBalanceFilters, v)}
              onOpenFilters={() => setFiltersOpen(true)}
              onClearAll={() => { setBalanceFilters([]); setClassFilters([]); }}
            />
          )}
          {view === "activity" && <Activity activity={data.activity} />}
          {view === "more" && <More />}
        </main>
        <nav className="bottom-nav" aria-label="Primary navigation"><NavButtons view={view} setView={setView} /></nav>
      </div>

      {quickActionStudent && (
        <QuickActionSheet
          student={quickActionStudent}
          onClose={() => setQuickActionId(null)}
          onMarkAttended={() => { data.markAttended(quickActionStudent.id); setQuickActionId(null); setUndo(`Marked ${quickActionStudent.name} attended`); }}
          onNoShow={() => { data.markNoShow(quickActionStudent.id); setQuickActionId(null); setUndo(`Marked ${quickActionStudent.name} as no-show`); }}
          onCancelClass={() => { data.cancelClass(quickActionStudent.id); setQuickActionId(null); setUndo(`Canceled ${quickActionStudent.name}'s class`); }}
          onLogPayment={() => { setPaymentFor(quickActionStudent.id); setQuickActionId(null); }}
        />
      )}

      {paymentFor && (
        <PaymentDialog students={data.students} defaultStudentId={paymentFor} onClose={() => setPaymentFor(null)} onSubmit={submitPayment} />
      )}

      {filtersOpen && (
        <FiltersSheet
          balanceFilters={balanceFilters}
          classFilters={classFilters}
          resultCount={filteredRoster.length}
          onToggleBalance={(v) => toggleFilter(balanceFilters, setBalanceFilters, v)}
          onToggleClass={(v) => toggleFilter(classFilters, setClassFilters, v)}
          onClearAll={() => { setBalanceFilters([]); setClassFilters([]); }}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {undo && (
        <div className="undo-toast" role="status">
          <span>{undo}<small>Undo available for 10 minutes</small></span>
          <button type="button" onClick={() => { const restored = data.undoLast(); setUndo(restored ? "Last action undone" : null); }}>Undo</button>
          <button type="button" aria-label="Dismiss notification" onClick={() => setUndo(null)}><Icon name="close" size={14} /></button>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return <div className="brand"><span className="brand-mark">C</span><span><b>ChalkTab</b><small>Class admin</small></span></div>;
}

const navItems: { id: View; label: string; icon: IconName }[] = [
  { id: "today", label: "Today", icon: "today" },
  { id: "students", label: "Students", icon: "students" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "more", label: "More", icon: "more" },
];

function NavButtons({ view, setView }: { view: View; setView: (v: View) => void }) {
  return <>{navItems.map((item) => (
    <button
      key={item.id}
      type="button"
      className={view === item.id ? "active" : ""}
      aria-current={view === item.id ? "page" : undefined}
      onClick={() => setView(item.id)}
    >
      <Icon name={item.icon} size={20} />
      {item.label}
    </button>
  ))}</>;
}

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</header>;
}

function Today({ students, stagedCount, totalToday, offline, onOpenRow, onConfirmBulk }: {
  students: Student[]; stagedCount: number; totalToday: number; offline: boolean;
  onOpenRow: (id: string) => void; onConfirmBulk: () => void;
}) {
  return (
    <>
      <PageHeading eyebrow="Tuesday, September 15" title="Today">
        <button className="icon-button" aria-label="Open notifications"><Icon name="info" size={17} /><span className="notification-dot" /></button>
      </PageHeading>

      {offline && (
        <div role="status" className="offline-banner">
          <Icon name="offline" size={18} />
          <span>You&rsquo;re offline — entries can&rsquo;t be saved until your connection comes back.</span>
        </div>
      )}

      <section className="section">
        <div className="section-title"><div><p className="eyebrow">6:00 PM</p><h2>Adult Beginner</h2></div></div>
        <div className="student-list" style={offline ? { opacity: 0.75 } : undefined}>
          {students.map((student) => (
            student.preCanceled ? (
              <div className="student-row" key={student.id} style={{ opacity: 0.6 }}>
                <div className="student-copy">
                  <strong>{student.name}</strong>
                  <small>Canceled by client · excluded from today&rsquo;s batch</small>
                </div>
                <span className="pill neutral">Canceled</span>
              </div>
            ) : (
              <button
                type="button"
                className="student-row"
                key={student.id}
                disabled={offline}
                onClick={() => onOpenRow(student.id)}
                style={{ width: "100%", textAlign: "left", border: student.session === "scheduled" ? "2px solid var(--brand)" : "1px solid var(--line)" }}
              >
                <div className="student-copy">
                  <strong>{student.name}</strong>
                  <small style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {student.session === "held" ? "Attended" : student.session === "noshow" ? "No-show" : student.session === "canceled" ? "Canceled" : (<>Scheduled <Icon name="chevronRight" size={11} /> <span style={{ color: "var(--brand-dark)", fontWeight: 600 }}>Attended</span></>)}
                  </small>
                </div>
                {student.session === "scheduled" && !offline && <span className="pill staged">Attended</span>}
                {!offline && <Icon name="chevronRight" size={17} />}
              </button>
            )
          ))}
        </div>
      </section>

      <div className="sticky-action">
        <div style={{ fontSize: ".75rem", color: "var(--muted)", textAlign: "center", marginBottom: ".4rem" }}>
          {offline ? "Reconnect to mark attendance" : `${stagedCount} of ${totalToday} students staged as Attended`}
        </div>
        <button type="button" className="primary" disabled={offline || stagedCount === 0} onClick={onConfirmBulk}>
          {offline ? "Mark attendance — offline" : `Mark attendance (${stagedCount})`}
        </button>
      </div>
    </>
  );
}

function QuickActionSheet({ student, onClose, onMarkAttended, onNoShow, onCancelClass, onLogPayment }: {
  student: Student; onClose: () => void; onMarkAttended: () => void; onNoShow: () => void; onCancelClass: () => void; onLogPayment: () => void;
}) {
  return (
    <DialogShell title={student.name} description="6:00 PM · Adult Beginner" onClose={onClose}>
      <div className="action-list">
        <button type="button" className="tone-brand" onClick={onMarkAttended}><Icon name="check" size={19} />Mark attended</button>
        <button type="button" className="tone-warn" onClick={onNoShow}><Icon name="warnTriangle" size={19} />No-show</button>
        <button type="button" className="tone-danger" onClick={onCancelClass}><Icon name="cancel" size={19} />Cancel class</button>
        <button type="button" onClick={onLogPayment}><Icon name="payment" size={19} />Log a payment</button>
        <button type="button" onClick={onClose}><Icon name="profile" size={19} />View profile</button>
      </div>
      <button type="button" className="text-button" style={{ width: "100%" }} onClick={onClose}>Keep scheduled</button>
    </DialogShell>
  );
}

function Students({ students, total, query, setQuery, balanceFilters, classFilters, onRemoveBalanceFilter, onOpenFilters, onClearAll }: {
  students: Student[]; total: number; query: string; setQuery: (s: string) => void;
  balanceFilters: BalanceState[]; classFilters: ClassGroup[];
  onRemoveBalanceFilter: (v: BalanceState) => void; onOpenFilters: () => void; onClearAll: () => void;
}) {
  const balanceLabels: Record<BalanceState, string> = { overdue: "Overdue", credit: "Credit", settled: "Paid up" };
  const hasFilters = balanceFilters.length > 0 || classFilters.length > 0;
  return (
    <>
      <PageHeading eyebrow="Roster" title="Students"><button className="primary compact">+ Add student</button></PageHeading>

      <div className="search-row">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Search students</span>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students" />
        </label>
      </div>

      <div className="filter-row" style={{ marginTop: ".7rem" }}>
        <button type="button" className="chip-button" onClick={onOpenFilters}><Icon name="filters" size={15} />Filters</button>
        {balanceFilters.map((f) => (
          <button type="button" className="chip-button active" key={f} onClick={() => onRemoveBalanceFilter(f)} aria-label={`Remove filter: Balance ${balanceLabels[f]}`}>
            Balance: {balanceLabels[f]}
            <span className="chip-remove" aria-hidden="true"><Icon name="close" size={9} /></span>
          </button>
        ))}
        {hasFilters && <button type="button" className="text-button" onClick={onClearAll}>Clear all</button>}
      </div>

      <p className="result-count">{students.length} of {total} students</p>

      <div className="student-grid">
        {students.map((student) => (
          <article className="profile-card" key={student.id}>
            <div className={`avatar${student.balanceState === "overdue" ? " danger" : ""}`}>{initials(student.name)}</div>
            <div>
              <h2>{student.name}</h2>
              <p style={{ margin: ".2rem 0 0" }}>{student.schedule}</p>
            </div>
            <span className={`pill ${student.balanceState === "overdue" ? "danger" : "neutral"}`}>
              {student.balanceState === "overdue" ? `${money(student.balance)} due` : balanceLabel(student)}
            </span>
          </article>
        ))}
      </div>
      {students.length === 0 && <div className="empty"><b>No matching students</b><p>Try clearing your search or filters.</p></div>}
    </>
  );
}

function FiltersSheet({ balanceFilters, classFilters, resultCount, onToggleBalance, onToggleClass, onClearAll, onClose }: {
  balanceFilters: BalanceState[]; classFilters: ClassGroup[]; resultCount: number;
  onToggleBalance: (v: BalanceState) => void; onToggleClass: (v: ClassGroup) => void; onClearAll: () => void; onClose: () => void;
}) {
  const balanceOptions: BalanceState[] = ["overdue", "credit", "settled"];
  const balanceLabels: Record<BalanceState, string> = { overdue: "Overdue", credit: "Credit", settled: "Paid up" };
  const classOptions: ClassGroup[] = ["Adult Beginner", "Adult Intermediate"];
  return (
    <DialogShell title="Filters" description="" onClose={onClose}>
      <div className="filter-group">
        <div className="filter-group-label">Balance status</div>
        <div className="filter-options">
          {balanceOptions.map((option) => (
            <button key={option} type="button" className="filter-toggle" aria-pressed={balanceFilters.includes(option)} onClick={() => onToggleBalance(option)}>
              {balanceLabels[option]}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <div className="filter-group-label">Class</div>
        <div className="filter-options">
          {classOptions.map((option) => (
            <button key={option} type="button" className="filter-toggle" aria-pressed={classFilters.includes(option)} onClick={() => onToggleClass(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="sheet-actions">
        <button type="button" className="secondary" onClick={onClearAll}>Clear all</button>
        <button type="button" className="primary" onClick={onClose}>Show {resultCount} results</button>
      </div>
    </DialogShell>
  );
}

function Activity({ activity }: { activity: ActivityEntry[] }) {
  return (
    <>
      <PageHeading eyebrow="Recap" title="Activity">
        <div className="day-nav">
          <button type="button" aria-label="Previous day" className="icon-button"><Icon name="chevronLeft" size={15} /></button>
          <strong>Tuesday, September 15</strong>
          <button type="button" aria-label="Next day" className="icon-button"><Icon name="chevronRight" size={15} /></button>
        </div>
      </PageHeading>

      <section className="section">
        <div className="recap-card info">
          <Icon name="info" size={18} />
          <div><b>2 sessions</b> still scheduled for today — mark them before end of day.</div>
        </div>
        <div className="recap-card warn">
          <Icon name="duplicate" size={18} />
          <div><b>Possible duplicate:</b> a $30 payment for Dana Kim was logged twice within 2 minutes.</div>
        </div>
        <div className="recap-card warn">
          <Icon name="warnTriangle" size={18} />
          <div><b>3 students</b> have balances overdue by 14+ days — Marcus Webb, Dana Kim, Rosa Petrov.</div>
        </div>
        <div className="recap-card danger">
          <Icon name="alert" size={18} />
          <div><b>Partial save failure:</b> 1 of 4 attendance updates from 4:00 PM didn&rsquo;t save.</div>
        </div>
        <button type="button" className="recap-retry">Retry now</button>
      </section>

      <section className="section recent">
        <div className="section-title"><h2>Timeline</h2></div>
        {activity.map((entry) => (
          <div className="activity-row" key={entry.id}>
            <span className={`activity-icon${entry.tone === "danger" ? " danger" : ""}`}><Icon name={entry.icon} size={15} /></span>
            <span>{entry.text}<small>{entry.time}</small></span>
          </div>
        ))}
      </section>
    </>
  );
}

function More() {
  return (
    <>
      <PageHeading eyebrow="Account" title="More" />
      <section className="section" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="profile-card">
          <div className="avatar" style={{ width: 48, height: 48, background: "var(--brand)", color: "#fff" }}>JB</div>
          <div>
            <h2>Jelani Brice</h2>
            <p>Adult gymnastics · Oistins</p>
          </div>
        </div>

        <div className="more-list">
          <button type="button"><Icon name="students" size={19} /><span>Recurring templates</span><Icon name="chevronRight" size={16} /></button>
          <button type="button"><Icon name="payment" size={19} /><span>Export statements</span><Icon name="chevronRight" size={16} /></button>
          <button type="button"><Icon name="info" size={19} /><span>Settings</span><Icon name="chevronRight" size={16} /></button>
        </div>

        <div className="more-list">
          <button type="button" className="danger-row"><Icon name="signout" size={19} /><span>Sign out</span></button>
        </div>

        <p className="more-footer">ChalkTab · v1</p>
      </section>
    </>
  );
}

function DialogShell({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={description ? "dialog-description" : undefined}>
        <div className="sheet-handle" />
        <header>
          <div>
            <p className="eyebrow">Quick action</p>
            <h2 id="dialog-title">{title}</h2>
            {description && <p id="dialog-description">{description}</p>}
          </div>
          <button ref={closeButton} type="button" className="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" size={16} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function PaymentDialog({ students, defaultStudentId, onClose, onSubmit }: {
  students: Student[]; defaultStudentId: string; onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <DialogShell title="Record payment" description="Payment is confirmed only after it is saved." onClose={onClose}>
      <form onSubmit={onSubmit} className="entry-form">
        <label>Student
          <select name="student" defaultValue={defaultStudentId}>
            {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {balanceLabel(student)}</option>)}
          </select>
        </label>
        <label>Amount (BBD)
          <span className="money-field"><span>$</span><input name="amount" type="number" min="0.01" step="0.01" defaultValue="30.00" required /></span>
        </label>
        <label>Date<input name="date" type="date" defaultValue="2026-09-15" required /></label>
        <fieldset>
          <legend>Payment method</legend>
          <div className="segmented">
            {["Cash", "Transfer", "Other"].map((method) => (
              <label key={method}>
                <input type="radio" name="method" value={method.toLowerCase()} defaultChecked={method === "Cash"} />
                <span>{method}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sheet-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" type="submit">Record payment</button>
        </div>
      </form>
    </DialogShell>
  );
}
