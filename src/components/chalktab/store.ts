"use client";

import { useEffect, useRef, useState } from "react";
import { logPayment, saveStudent, undoOperation, type MutationResult } from "@/actions/ledger";
import { refreshUiLedger, runUiCommand } from "@/actions/ui-ledger";
import { remainingClasses } from "@/lib/domain/packages";
import type { StudentPackage } from "@/lib/domain/packages";
import type { Json } from "@/lib/supabase/database.types";
import { projectUi, type UiLedgerData } from "./projection";
import type { LedgerAction } from "./model";
export * from "./model";
export type { UiLedgerData } from "./projection";

type Attempt = { fingerprint: string; run: () => Promise<MutationResult>; confirmed: boolean };

export function useLedgerStore(initial: UiLedgerData) {
  const data = useRef(initial);
  const [state, setState] = useState(() => projectUi(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const [receipt, setReceipt] = useState<{ id: string; until: string } | null>(null);
  useEffect(() => {
    if (!receipt) return;
    const timeout = setTimeout(() => setReceipt(null), Math.max(0, new Date(receipt.until).getTime() - Date.now()));
    return () => clearTimeout(timeout);
  }, [receipt]);

  async function execute(current: Attempt): Promise<boolean> {
    if (inFlight.current) return false;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setError("You’re offline. Keep this screen open and retry when connected."); return false; }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      if (!current.confirmed) {
        const result = await current.run();
        if (!result.ok) {
          setError(result.code === "VALIDATION" ? "Check the entered values." : result.message);
          if (result.code !== "DATABASE") attempt.current = null;
          return false;
        }
        current.confirmed = true;
        const r = result.data as { operationId?: string; undoExpiresAt?: string };
        setReceipt(r.operationId && r.undoExpiresAt ? { id: r.operationId, until: r.undoExpiresAt } : null);
      }
      const fresh = await refreshUiLedger();
      data.current = fresh;
      setState(projectUi(fresh)); setHasDraft(false); attempt.current = null;
      return true;
    } catch {
      setError(current.confirmed ? "Saved. The latest balances could not be loaded; retry to refresh." : "Save outcome unknown. Retry to check the same request safely.");
      return false;
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function apply(action: LedgerAction, _label?: string): Promise<boolean> {
    void _label;
    if (inFlight.current) return false;
    if (action.type === "mark") {
      if (attempt.current) { setError("Resolve the pending save before changing attendance."); return false; }
      setState(s => { const marks = { ...s.classSession.marks }; if (action.mark) marks[action.studentId] = action.mark; else delete marks[action.studentId]; return { ...s, classSession: { ...s.classSession, marks } }; });
      setHasDraft(true); return true;
    }
    const fingerprint = JSON.stringify(action);
    if (attempt.current) {
      if (attempt.current.fingerprint !== fingerprint) { setError("Resolve the pending save with Retry before submitting a different change."); return false; }
      return execute(attempt.current);
    }
    const key = crypto.randomUUID();
    const student = "studentId" in action ? data.current.dashboard.students.find(s => s.id === action.studentId) : undefined;
    let run: () => Promise<MutationResult>;
    if (action.type === "recordPayment") {
      const input = { idempotencyKey: key, studentId: action.studentId, amountCents: action.amountCents, paymentDate: action.date, method: action.method };
      run = () => logPayment(input);
    } else if (["updateStudent", "saveNotes", "archiveStudent", "restoreStudent", "createStudent"].includes(action.type)) {
      const input = { idempotencyKey: key, studentId: student?.id ?? null, expectedVersion: student?.version ?? null,
        name: action.type === "updateStudent" || action.type === "createStudent" ? action.name : student?.name ?? "",
        defaultRateCents: action.type === "updateStudent" || action.type === "createStudent" ? action.rateCents : student?.defaultRateCents ?? 0,
        notes: action.type === "saveNotes" ? action.notes : student?.notes ?? null,
        archived: action.type === "archiveStudent" ? true : action.type === "restoreStudent" ? false : Boolean(student?.archivedAt) };
      run = () => saveStudent(input);
    } else {
      let command: unknown = action;
      if (action.type === "completeClass" || action.type === "logSession") {
        const date = action.type === "logSession" ? action.date : state.classSession.date;
        const marks = action.type === "logSession" ? { [action.studentId]: action.mark } : state.classSession.marks;
        command = { type: "attendance", date, entries: Object.entries(marks).map(([studentId, mark]) => {
          const session = data.current.dashboard.sessions.find(s => s.studentId === studentId && s.sessionDate === date && !s.voidedAt && s.occurrenceNumber === 1);
          return { studentId, mark, sessionId: session?.id ?? null, expectedVersion: session?.version ?? null };
        }) };
      }
      if (action.type === "toggleEnrolled") command = { ...action, enrolled: !state.students.find(s => s.id === action.studentId)?.enrolled, expectedVersion: student?.version };
      if (action.type === "saveSchedule") command = { ...action, expectedVersion: state.schedule?.version ?? 0 };
      run = () => runUiCommand({ key, command: command as Json });
    }
    const current = { fingerprint, run, confirmed: false };
    attempt.current = current;
    return execute(current);
  }

  return { state, busy, error, hasDraft, apply,
    canUndo: Boolean(receipt),
    undoUntil: receipt ? new Date(receipt.until).toLocaleTimeString() : "",
    async retry() {
      if (attempt.current) return execute(attempt.current);
      if (inFlight.current) return false;
      try { const fresh=await refreshUiLedger(); data.current=fresh; setState(projectUi(fresh)); setError(null); setHasDraft(false); return false; }
      catch { setError("Could not refresh. Check your connection and retry."); return false; }
    },
    async undo() {
      if (!receipt || attempt.current) return false;
      const input = { idempotencyKey: crypto.randomUUID(), operationId: receipt.id };
      const current = { fingerprint: "undo", run: () => undoOperation(input), confirmed: false };
      attempt.current = current;
      return execute(current);
    },
  };
}
export type LedgerStore = ReturnType<typeof useLedgerStore>;
export function remainingText(pkg: StudentPackage) { const n=remainingClasses(pkg); return n === null ? "Unlimited" : `${n} remaining`; }
