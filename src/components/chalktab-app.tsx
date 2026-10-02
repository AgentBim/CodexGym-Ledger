"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AttendanceScreen, ClassCompleteScreen, TodayScreen } from "./chalktab/class-screens";
import { AppContext, type AppContextValue, type Route, type SheetState } from "./chalktab/context";
import { AssignPackageScreen, MoreScreen, NewPackageScreen, PackagesScreen } from "./chalktab/package-screens";
import { ActivityScreen, StudentProfileScreen, StudentsScreen } from "./chalktab/people-screens";
import { ActiveSheet } from "./chalktab/sheets";
import { useLedgerStore, type UiLedgerData } from "./chalktab/store";
import { Brand, Icon, type IconName } from "./chalktab/ui";

type Tab = "today" | "students" | "activity" | "more";
const navItems: { id: Tab; label: string; icon: IconName }[] = [
  { id: "today", label: "Today", icon: "home" },
  { id: "students", label: "Students", icon: "users" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "more", label: "More", icon: "more" },
];

function tabOf(route: Route): Tab {
  switch (route.name) {
    case "today": case "attendance": case "complete": return "today";
    case "students": case "student": case "assign": return "students";
    case "activity": return "activity";
    default: return "more";
  }
}

type Toast = { id: number; message: string; undoable: boolean };

export function ChalkTabApp({ data }: { data: UiLedgerData }) {
  const store = useLedgerStore(data);
  const [stack, setStack] = useState<Route[]>([{ name: "today" }]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const route = useMemo<Route>(() => stack[stack.length - 1] ?? { name: "today" }, [stack]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.undoable ? 10 * 60 * 1000 : 6000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [route]);

  const go = useCallback((next: Route) => setStack((current) => next.name === "today" ? [next] : [...current, next]), []);
  const back = useCallback(() => setStack((current) => current.length > 1 ? current.slice(0, -1) : current), []);
  const notify = useCallback((message: string, undoable = false) => setToast({ id: Date.now(), message, undoable }), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const context = useMemo<AppContextValue>(() => ({ store, route, go, back, openSheet: setSheet, closeSheet, notify }), [store, route, go, back, closeSheet, notify]);
  const current = tabOf(route);
  const hideNav = route.name === "attendance";
  const key = JSON.stringify(route);

  return (
    <AppContext.Provider value={context}>
      <div aria-busy={store.busy} className={`app-frame${hideNav ? " no-nav" : ""}${toast ? " has-toast" : ""}`}>
        <aside className="side-nav" aria-label="Primary navigation">
          <Brand />
          {navItems.map((item) => <NavButton key={item.id} item={item} active={current === item.id} onClick={() => setStack([{ name: item.id }])} />)}
        </aside>
        <div className="app-content">
          {["today", "activity"].includes(route.name) && <header className="topbar"><Brand /></header>}
          <main id="main-content" className="main-content">
            <p className="save-status" role="status">{store.busy ? "Saving…" : store.hasDraft ? "Attendance draft · not saved" : "Connected to your ledger"}</p>
            {store.error && <div className="notice" role="alert">{store.error}<button className="secondary compact" onClick={async () => { if (await store.retry()) { closeSheet(); go({ name: "today" }); notify("Saved and refreshed"); } }}>Retry</button></div>}
            {route.name === "today" && <TodayScreen />}
            {route.name === "attendance" && <AttendanceScreen />}
            {route.name === "complete" && <ClassCompleteScreen />}
            {route.name === "students" && <StudentsScreen key={key} initialFilter={route.filter} />}
            {route.name === "student" && <StudentProfileScreen key={key} studentId={route.id} initialTab={route.tab} />}
            {route.name === "activity" && <ActivityScreen key={key} initialTab={route.tab} />}
            {route.name === "more" && <MoreScreen />}
            {route.name === "packages" && <PackagesScreen />}
            {route.name === "newPackage" && <NewPackageScreen />}
            {route.name === "assign" && <AssignPackageScreen key={key} studentId={route.studentId} packageId={route.packageId} />}
          </main>
          {!hideNav && (
            <nav className="bottom-nav" aria-label="Primary navigation">
              {navItems.map((item) => <NavButton key={item.id} item={item} active={current === item.id} onClick={() => setStack([{ name: item.id }])} />)}
            </nav>
          )}
        </div>
        {sheet && <ActiveSheet sheet={sheet} />}
        <div className="toast-region" aria-live="polite">
          {toast && (
            <div className="toast" key={toast.id}>
              <span>{toast.message}{toast.undoable && store.canUndo && <small>Undo available until {store.undoUntil}</small>}</span>
              {toast.undoable && store.canUndo && <button onClick={async () => { if (await store.undo()) setToast({ id: Date.now(), message: "Last change undone", undoable: false }); }}>Undo</button>}
              <button aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={16} /></button>
            </div>
          )}
        </div>
      </div>
    </AppContext.Provider>
  );
}

function NavButton({ item, active, onClick }: { item: typeof navItems[number]; active: boolean; onClick: () => void }) {
  return <button className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}><Icon name={item.icon} size={22} />{item.label}</button>;
}
