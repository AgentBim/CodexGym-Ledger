"use client";

import { useState, type FormEvent } from "react";
import { formatDate, formatShortDate } from "@/lib/domain/calendar";
import { activeHolderCount, classCountLabel, formatMoney, packageEndDate, validityLabel, type PackageKind } from "@/lib/domain/packages";
import { useApp } from "./context";
import { Field, Icon, ListButton, ScreenHeader, Tabs, toCents } from "./ui";

const validityOptions = [null, 1, 4, 6, 8, 10, 12, 16, 26, 52] as const;

export function MoreScreen() {
  const { go } = useApp();
  return (
    <>
      <h1 className="title">More</h1>
      <div className="card-list spaced">
        <ListButton icon="package" title="Packages & credits" subtitle="Terms, class packs and drop-ins" onClick={() => go({ name: "packages" })} />
        <ListButton icon="calendar" title="Class schedule" subtitle="Recurring class and upcoming dates" onClick={() => go({ name: "activity", tab: "schedule" })} />
        <ListButton icon="archive" title="Archived students" onClick={() => go({ name: "students", filter: "archived" })} />
      </div>
      <p className="muted small">Demo data only. Nothing here is saved to the server yet.</p>
    </>
  );
}

export function PackagesScreen() {
  const { store: { state }, back, go, openSheet } = useApp();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const list = state.packages.filter((p) => p.archived === (tab === "archived"));
  return (
    <>
      <ScreenHeader title="Packages & credits" onBack={back} />
      <Tabs label="Package status" variant="solid" value={tab} onChange={setTab} tabs={[{ id: "active", label: "Active" }, { id: "archived", label: "Archived" }]} />
      {list.length === 0 ? <div className="empty"><b>No {tab} packages</b>{tab === "active" && <p>Create a term or class pack to start assigning it.</p>}</div> : (
        <div className="card-list">
          {list.map((p) => {
            const holders = activeHolderCount(p.id, state.studentPackages, state.today);
            return (
              <button key={p.id} className="package-row" onClick={() => openSheet({ kind: "packageOptions", packageId: p.id })}>
                <span className="tile-icon brand"><Icon name={p.kind === "time_based" ? "calendar" : "ticket"} /></span>
                <span className="list-button-copy"><b>{p.name}</b><small>{formatMoney(p.priceCents)} · {classCountLabel(p.classCount)}</small><small>{validityLabel(p.validityWeeks)}</small></span>
                <span className={`chip small ${p.archived ? "" : "done"}`}>{p.archived ? "Archived" : holders ? `${holders} active` : "Active"}</span>
              </button>
            );
          })}
        </div>
      )}
      <button className="outline block" onClick={() => go({ name: "newPackage" })}><Icon name="plus" /> New package / credit</button>
    </>
  );
}

export function NewPackageScreen() {
  const { store, back, go, notify } = useApp();
  const [kind, setKind] = useState<PackageKind>("class_pack");
  const [classCount, setClassCount] = useState(12);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const priceCents = toCents(form.get("price"));
    const validity = String(form.get("validity"));
    if (!name) return setError("Enter a package name.");
    if (priceCents === null) return setError("Enter a valid price.");
    store.apply({ type: "createPackage", definition: {
      name, description: String(form.get("description") ?? "").trim(), kind, priceCents,
      classCount: kind === "class_pack" ? classCount : null,
      validityWeeks: validity === "none" ? null : Number(validity),
      archived: form.get("activate") !== "on",
    } }, "Package created");
    notify(`${name} created`, true);
    go({ name: "packages" });
  }

  return (
    <>
      <ScreenHeader title="New term / package" onBack={back} />
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Name"><input name="name" placeholder="12-Class Term" required maxLength={80} /></Field>
        <Field label="Description (optional)"><input name="description" placeholder="Valid for 12 weeks. Adult gymnastics." maxLength={200} /></Field>
        <fieldset className="field"><legend className="field-label">Type</legend>
          <div className="segmented">
            <label><input type="radio" name="kind" checked={kind === "class_pack"} onChange={() => setKind("class_pack")} /><span>Class pack</span></label>
            <label><input type="radio" name="kind" checked={kind === "time_based"} onChange={() => setKind("time_based")} /><span>Time-based</span></label>
          </div>
        </fieldset>
        {kind === "class_pack" ? (
          <div className="field"><span className="field-label" id="class-count-label">Number of classes</span>
            <div className="stepper">
              <button type="button" aria-label="Fewer classes" disabled={classCount <= 1} onClick={() => setClassCount((n) => Math.max(1, n - 1))}><Icon name="minus" /></button>
              <input aria-labelledby="class-count-label" inputMode="numeric" value={classCount} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setClassCount(Math.min(200, Math.max(1, n || 1))); }} />
              <button type="button" aria-label="More classes" disabled={classCount >= 200} onClick={() => setClassCount((n) => Math.min(200, n + 1))}><Icon name="plus" /></button>
            </div>
          </div>
        ) : <p className="hint">Unlimited classes while the package is valid.</p>}
        <Field label="Price (BBD)"><span className="money-field"><span>$</span><input name="price" type="number" inputMode="decimal" min="0" step="0.01" placeholder="300.00" required /></span></Field>
        <Field label="Validity (optional)">
          <select name="validity" defaultValue="12">{validityOptions.map((w) => <option key={w ?? "none"} value={w ?? "none"}>{w === null ? "No expiry" : `${w} ${w === 1 ? "week" : "weeks"}`}</option>)}</select>
        </Field>
        <label className="switch-row"><span>Activate immediately</span><input type="checkbox" role="switch" name="activate" defaultChecked /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary block" type="submit">Create package</button>
        <p className="hint center">This package can then be assigned to students.</p>
      </form>
    </>
  );
}

export function AssignPackageScreen({ studentId, packageId }: { studentId?: string; packageId?: string }) {
  const { store, back, go, notify } = useApp();
  const { state } = store;
  const students = state.students.filter((s) => s.status === "active");
  const packages = state.packages.filter((p) => !p.archived);
  const [student, setStudent] = useState(studentId ?? students[0]?.id ?? "");
  const [pkgId, setPkgId] = useState(packageId ?? packages[0]?.id ?? "");
  const [start, setStart] = useState(state.today);
  const [endOverride, setEndOverride] = useState<string | null>(null);
  const pkg = packages.find((p) => p.id === pkgId);
  const autoEnd = pkg ? packageEndDate(start, pkg.validityWeeks) : null;
  const end = endOverride ?? autoEnd;
  const invalid = !student || !pkg || !start || (end !== null && end < start);

  function assign() {
    if (invalid || !pkg) return;
    store.apply({ type: "assignPackage", studentId: student, packageId: pkg.id, startDate: start, endDate: end }, "Package assigned");
    notify(`${pkg.name} assigned · ${formatMoney(pkg.priceCents)} added to balance`, true);
    go({ name: "student", id: student, tab: "packages" });
  }

  if (!packages.length) return <><ScreenHeader title="Assign package" onBack={back} /><div className="empty"><b>No active packages</b><p>Create a package first.</p><button className="primary" onClick={() => go({ name: "newPackage" })}>New package</button></div></>;

  return (
    <>
      <ScreenHeader title="Assign package" onBack={back} />
      <div className="form">
        <Field label="Student"><select value={student} onChange={(e) => setStudent(e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Package"><select value={pkgId} onChange={(e) => { setPkgId(e.target.value); setEndOverride(null); }}>{packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatMoney(p.priceCents)} · {classCountLabel(p.classCount)}</option>)}</select></Field>
        <Field label="Start date"><input type="date" value={start} onChange={(e) => { setStart(e.target.value); setEndOverride(null); }} /></Field>
        <Field label="End date (optional)" hint="End date is calculated from the package’s validity. Change it to override.">
          <input type="date" value={end ?? ""} min={start} onChange={(e) => setEndOverride(e.target.value)} />
        </Field>
        {end !== null && end < start && <p className="form-error" role="alert">End date must be on or after the start date.</p>}
        {pkg && (
          <section className="panel summary-box" aria-label="Package summary">
            <small>Package summary</small>
            <b>{pkg.name}</b>
            <span>{classCountLabel(pkg.classCount)} · {formatMoney(pkg.priceCents)}</span>
            <span>{validityLabel(pkg.validityWeeks)}</span>
            <span>{formatShortDate(start)} – {end ? formatDate(end) : "no expiry"}</span>
            <small>{formatMoney(pkg.priceCents)} will be added to the student’s balance.</small>
          </section>
        )}
        <button className="primary block" disabled={invalid} onClick={assign}>Assign to student</button>
      </div>
    </>
  );
}
