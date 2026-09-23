"use client";

import { useState, type FormEvent } from "react";
import { formatDate } from "@/lib/domain/calendar";
import { activeHolderCount, classCountLabel, formatMoney, packageForSession, usagePreview, validityLabel } from "@/lib/domain/packages";
import { useApp, type SheetState } from "./context";
import { balanceLabel, markLabel, type AttendanceMark, type PaymentMethod } from "./store";
import { Field, Icon, Progress, Sheet, toCents } from "./ui";

export function ActiveSheet({ sheet }: { sheet: SheetState }) {
  switch (sheet.kind) {
    case "session": return <SessionSheet {...sheet} />;
    case "payment": return <PaymentSheet studentId={sheet.studentId} />;
    case "adjust": return <AdjustSheet studentId={sheet.studentId} />;
    case "archive": return <ArchiveSheet studentId={sheet.studentId} />;
    case "edit": return <EditSheet studentId={sheet.studentId} />;
    case "packageOptions": return <PackageOptionsSheet packageId={sheet.packageId} />;
  }
}

function SessionSheet({ studentId, mark = "present", fromAttendance }: { studentId: string; mark?: AttendanceMark; fromAttendance?: boolean }) {
  const { store, closeSheet, notify } = useApp();
  const { state } = store;
  const student = state.students.find((s) => s.id === studentId);
  const [date, setDate] = useState(fromAttendance ? state.classSession.date : state.today);
  const [status, setStatus] = useState<AttendanceMark>(mark);
  if (!student) return null;
  const pkg = packageForSession(state.studentPackages, studentId, date);
  const preview = pkg ? usagePreview(pkg) : null;
  const attending = status !== "absent";

  function confirm() {
    if (fromAttendance) store.apply({ type: "mark", studentId, mark: status });
    else {
      store.apply({ type: "logSession", studentId, date, mark: status }, "Session logged");
      notify(`${markLabel[status]} logged for ${student?.name} · ${formatDate(date)}`, true);
    }
    closeSheet();
  }

  return (
    <Sheet title="Confirm session" onClose={closeSheet} footer={<><button className="secondary" onClick={closeSheet}>Cancel</button><button className="primary" disabled={!date} onClick={confirm}>Confirm</button></>}>
      <div className="form">
        <Field label="Student"><input value={student.name} readOnly /></Field>
        <Field label="Date"><input type="date" value={date} readOnly={fromAttendance} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as AttendanceMark)}>{(["present", "late", "absent"] as const).map((m) => <option key={m} value={m}>{markLabel[m]}</option>)}</select></Field>
        <section className="usage-box" aria-live="polite">
          <small>Package usage</small>
          {!attending ? <p>Absent sessions don’t use a class or add a charge.</p>
            : pkg && preview ? (
              <>
                <b>{pkg.name}</b>
                {preview.total === null ? <p>Unlimited · valid until {pkg.endDate ? formatDate(pkg.endDate) : "no expiry"}</p> : (
                  <>
                    <p>{preview.usedBefore} / {preview.total} used <Icon name="arrowRight" size={14} /> <b>{preview.usedAfter} / {preview.total} used</b></p>
                    <Progress value={preview.usedAfter} max={preview.total} label={`${preview.usedAfter} of ${preview.total} used after this session`} />
                    <small>{preview.remainingAfter} remaining after this session</small>
                  </>
                )}
              </>
            ) : <p>No active package on this date. {formatMoney(student.rateCents)} will be charged at {student.name}’s rate.</p>}
        </section>
        {fromAttendance && <p className="hint">The class is deducted when you complete the class.</p>}
      </div>
    </Sheet>
  );
}

function PaymentSheet({ studentId }: { studentId?: string }) {
  const { store, closeSheet, notify } = useApp();
  const { state } = store;
  const students = state.students.filter((s) => s.status === "active" || s.id === studentId);
  const [selected, setSelected] = useState(studentId ?? students[0]?.id ?? "");
  const student = state.students.find((s) => s.id === selected);
  const [amount, setAmount] = useState(() => student && student.balanceCents > 0 ? (student.balanceCents / 100).toFixed(2) : "");
  const [date, setDate] = useState(state.today);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const cents = toCents(amount);
  const valid = Boolean(student) && cents !== null && cents > 0 && Boolean(date);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || cents === null) return;
    store.apply({ type: "recordPayment", studentId: selected, amountCents: cents, date, method }, "Payment recorded");
    notify(`${formatMoney(cents)} payment recorded for ${student?.name}`, true);
    closeSheet();
  }

  return (
    <Sheet title="Record payment" onClose={closeSheet}>
      <form className="form" onSubmit={submit}>
        {studentId && student ? <Field label="Student"><input value={student.name} readOnly /></Field> : (
          <Field label="Student"><select value={selected} onChange={(e) => { setSelected(e.target.value); const s = state.students.find((x) => x.id === e.target.value); setAmount(s && s.balanceCents > 0 ? (s.balanceCents / 100).toFixed(2) : ""); }}>{students.map((s) => <option key={s.id} value={s.id}>{s.name} · {balanceLabel(s)}</option>)}</select></Field>
        )}
        <Field label="Amount (BBD)"><span className="money-field"><span>$</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></span></Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <fieldset className="field"><legend className="field-label">Method</legend>
          <div className="segmented three">{(["cash", "transfer", "other"] as const).map((m) => <label key={m}><input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} /><span>{m[0]?.toUpperCase()}{m.slice(1)}</span></label>)}</div>
        </fieldset>
        {student && cents !== null && cents > 0 && <p className="hint">Balance after: {balanceLabel({ balanceCents: student.balanceCents - cents, overdue: student.overdue && student.balanceCents - cents > 0 })}</p>}
        <div className="sheet-actions"><button type="button" className="secondary" onClick={closeSheet}>Cancel</button><button className="primary" type="submit" disabled={!valid}>Record {cents ? formatMoney(cents) : ""} payment</button></div>
      </form>
    </Sheet>
  );
}

function AdjustSheet({ studentId }: { studentId: string }) {
  const { store, closeSheet, notify } = useApp();
  const student = store.state.students.find((s) => s.id === studentId);
  const [direction, setDirection] = useState<"charge" | "credit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const cents = toCents(amount);
  const valid = cents !== null && cents > 0 && reason.trim().length > 0;
  if (!student) return null;
  const delta = (cents ?? 0) * (direction === "charge" ? 1 : -1);

  return (
    <Sheet title="Adjust balance" onClose={closeSheet} footer={<><button className="secondary" onClick={closeSheet}>Cancel</button><button className="primary" disabled={!valid} onClick={() => { store.apply({ type: "adjustBalance", studentId, deltaCents: delta, reason: reason.trim() }, "Balance adjusted"); notify(`Balance adjusted for ${student.name}`, true); closeSheet(); }}>Apply adjustment</button></>}>
      <div className="form">
        <p className="muted">Current balance: {balanceLabel(student)}</p>
        <fieldset className="field"><legend className="field-label">Adjustment</legend>
          <div className="segmented"><label><input type="radio" name="direction" checked={direction === "credit"} onChange={() => setDirection("credit")} /><span>Add credit</span></label><label><input type="radio" name="direction" checked={direction === "charge"} onChange={() => setDirection("charge")} /><span>Add charge</span></label></div>
        </fieldset>
        <Field label="Amount (BBD)"><span className="money-field"><span>$</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></span></Field>
        <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Class cancelled by coach" maxLength={120} /></Field>
        {valid && <p className="hint">Balance after: {balanceLabel({ balanceCents: student.balanceCents + delta, overdue: student.overdue && student.balanceCents + delta > 0 })}</p>}
      </div>
    </Sheet>
  );
}

function ArchiveSheet({ studentId }: { studentId: string }) {
  const { store, closeSheet, notify } = useApp();
  const student = store.state.students.find((s) => s.id === studentId);
  if (!student) return null;
  return (
    <Sheet title={`Archive ${student.name}?`} onClose={closeSheet} footer={<><button className="secondary" onClick={closeSheet}>Keep active</button><button className="danger" onClick={() => { store.apply({ type: "archiveStudent", studentId }, "Student archived"); notify(`${student.name} archived`, true); closeSheet(); }}><Icon name="archive" /> Archive student</button></>}>
      <p className="muted">They will leave class lists. Their history{student.balanceCents !== 0 ? ` and ${balanceLabel(student).toLowerCase()} balance` : ""} remain.</p>
    </Sheet>
  );
}

function EditSheet({ studentId }: { studentId: string }) {
  const { store, closeSheet, notify } = useApp();
  const student = store.state.students.find((s) => s.id === studentId);
  const [name, setName] = useState(student?.name ?? "");
  const [rate, setRate] = useState(student ? (student.rateCents / 100).toFixed(2) : "");
  if (!student) return null;
  const cents = toCents(rate);
  const valid = name.trim().length > 0 && cents !== null;
  return (
    <Sheet title="Edit student" onClose={closeSheet} footer={<><button className="secondary" onClick={closeSheet}>Cancel</button><button className="primary" disabled={!valid} onClick={() => { if (cents === null) return; store.apply({ type: "updateStudent", studentId, name: name.trim(), rateCents: cents }, "Student updated"); notify("Student updated", true); closeSheet(); }}>Save</button></>}>
      <div className="form">
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <Field label="Drop-in rate (BBD)" hint="Existing session charges will not change."><span className="money-field"><span>$</span><input type="number" inputMode="decimal" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></span></Field>
      </div>
    </Sheet>
  );
}

function PackageOptionsSheet({ packageId }: { packageId: string }) {
  const { store, closeSheet, go, notify } = useApp();
  const pkg = store.state.packages.find((p) => p.id === packageId);
  if (!pkg) return null;
  const holders = activeHolderCount(pkg.id, store.state.studentPackages, store.state.today);
  return (
    <Sheet title={pkg.name} onClose={closeSheet}>
      <div className="form">
        {pkg.description && <p className="muted">{pkg.description}</p>}
        <dl className="details">
          <div><dt>Price</dt><dd>{formatMoney(pkg.priceCents)}</dd></div>
          <div><dt>Classes</dt><dd>{classCountLabel(pkg.classCount)}</dd></div>
          <div><dt>Validity</dt><dd>{validityLabel(pkg.validityWeeks)}</dd></div>
          <div><dt>Students using it</dt><dd>{holders}</dd></div>
        </dl>
        {!pkg.archived && <button className="primary block" onClick={() => { closeSheet(); go({ name: "assign", packageId: pkg.id }); }}>Assign to student</button>}
        <button className={pkg.archived ? "secondary block" : "danger block"} onClick={() => { store.apply({ type: "setPackageArchived", packageId: pkg.id, archived: !pkg.archived }, pkg.archived ? "Package restored" : "Package archived"); notify(`${pkg.name} ${pkg.archived ? "restored" : "archived"}`, true); closeSheet(); }}>
          <Icon name="archive" /> {pkg.archived ? "Restore package" : "Archive package"}
        </button>
        {!pkg.archived && holders > 0 && <p className="hint">Archiving stops new assignments. Students keep their remaining classes.</p>}
      </div>
    </Sheet>
  );
}
