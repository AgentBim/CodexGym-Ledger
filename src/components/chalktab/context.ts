"use client";

import { createContext, useContext } from "react";
import type { AttendanceMark, LedgerStore } from "./store";

export type StudentTab = "overview" | "history" | "payments" | "packages" | "notes";
export type ActivityTab = "timeline" | "schedule" | "audit";
export type StudentFilter = "all" | "overdue" | "owes" | "settled" | "credit" | "owing" | "archived";

export type Route =
  | { name: "today" }
  | { name: "attendance" }
  | { name: "complete" }
  | { name: "students"; filter?: StudentFilter }
  | { name: "student"; id: string; tab?: StudentTab }
  | { name: "activity"; tab?: ActivityTab }
  | { name: "more" }
  | { name: "packages" }
  | { name: "newPackage" }
  | { name: "assign"; studentId?: string; packageId?: string };

export type SheetState =
  | { kind: "payment"; studentId?: string }
  | { kind: "session"; studentId: string; mark?: AttendanceMark; fromAttendance?: boolean }
  | { kind: "adjust"; studentId: string }
  | { kind: "archive"; studentId: string }
  | { kind: "edit"; studentId: string }
  | { kind: "packageOptions"; packageId: string };

export type AppContextValue = {
  store: LedgerStore;
  route: Route;
  go: (route: Route) => void;
  back: () => void;
  openSheet: (sheet: SheetState) => void;
  closeSheet: () => void;
  notify: (message: string, undoable?: boolean) => void;
};

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppContext");
  return value;
}
