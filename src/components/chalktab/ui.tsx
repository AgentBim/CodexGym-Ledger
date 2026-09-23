"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { remainingClasses, type StudentPackage } from "@/lib/domain/packages";
import { balanceLabel, balanceState, type Student } from "./store";

const paths = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7",
  activity: "M4 7c2.5-2 5.5-2 8 0s5.5 2 8 0M4 12c2.5-2 5.5-2 8 0s5.5 2 8 0M4 17c2.5-2 5.5-2 8 0s5.5 2 8 0",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "M15 18l-6-6 6-6",
  chevron: "M9 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 3.5 2.5 20h19zM12 10v4.5M12 17.5h.01",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  calendar: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4",
  cash: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M6.5 10v.01M17.5 14v.01",
  clipboard: "M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15M9 13l2 2 4-4",
  user: "M18 20v-1.5a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4V20M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  repeat: "M17 2.5l3 3-3 3M4 11.5V10a4.5 4.5 0 0 1 4.5-4.5H20M7 21.5l-3-3 3-3M20 12.5V14a4.5 4.5 0 0 1-4.5 4.5H4",
  ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M5.6 5.6l12.8 12.8",
  package: "M4 7.5 12 3.5l8 4v9l-8 4-8-4zM4 7.5l8 4 8-4M12 11.5v9",
  archive: "M3.5 4.5h17v4h-17zM5 8.5v10a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-10M10 12.5h4",
  sliders: "M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3.5 2",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  close: "M6 6l12 12M18 6 6 18",
  ticket: "M3.5 8.5V6h17v2.5a2.5 2.5 0 0 0 0 5V18h-17v-4.5a2.5 2.5 0 0 0 0-5M14 6v12",
  circle: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16",
  userPlus: "M15 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase();
}

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return <span className={`avatar${large ? " large" : ""}`} aria-hidden="true">{initials(name)}</span>;
}

export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true">C</span><span><b>ChalkTab</b><small>Attendance &amp; payments</small></span></div>;
}

export function BalanceTag({ student }: { student: Pick<Student, "balanceCents" | "overdue"> }) {
  const state = balanceState(student);
  const icon = state === "credit" ? "arrowDown" : state === "settled" ? "check" : state === "owes" ? "circle" : "alert";
  return <span className={`balance ${state}`}><Icon name={icon} size={14} />{state === "overdue" && <span className="sr-only">Overdue ·</span>}{balanceLabel(student)}</span>;
}

export function ScreenHeader({ title, onBack, children }: { title: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <header className="screen-header">
      {onBack && <button className="icon-button plain" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>}
      <h1>{title}</h1>
      {children && <div className="screen-header-actions">{children}</div>}
    </header>
  );
}

export function Tabs<T extends string>({ label, tabs, value, onChange, variant = "pill" }: { label: string; tabs: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void; variant?: "pill" | "solid" }) {
  return (
    <div className={`tabs ${variant}`} role="tablist" aria-label={label}>
      {tabs.map((tab) => <button key={tab.id} role="tab" aria-selected={value === tab.id} className={value === tab.id ? "active" : ""} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
    </div>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  return <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${max ? Math.min(100, (value / max) * 100) : 100}%` }} /></div>;
}

export function PackageUsage({ pkg }: { pkg: StudentPackage }) {
  const remaining = remainingClasses(pkg);
  return pkg.classCount === null
    ? <p className="usage">{pkg.used} {pkg.used === 1 ? "class" : "classes"} attended · Unlimited</p>
    : <><p className="usage">{pkg.used} / {pkg.classCount} used</p><Progress value={pkg.used} max={pkg.classCount} label={`${pkg.name}: ${pkg.used} of ${pkg.classCount} used, ${remaining} remaining`} /></>;
}

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); trigger?.focus?.(); };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header"><h2 id={titleId}>{title}</h2><button ref={closeButton} type="button" className="icon-button round" aria-label="Close" onClick={onClose}><Icon name="close" size={16} /></button></header>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-actions">{footer}</div>}
      </section>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small className="hint">{hint}</small>}</label>;
}

export function ListButton({ icon, tone = "brand", title, subtitle, onClick }: { icon: IconName; tone?: "brand" | "amber" | "blue" | "red"; title: string; subtitle?: string; onClick: () => void }) {
  return <button className="list-button" onClick={onClick}><span className={`tile-icon ${tone}`}><Icon name={icon} /></span><span className="list-button-copy"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</span><Icon name="chevron" /></button>;
}

/** Parses a dollars string into integer cents, or null when invalid. */
export function toCents(value: FormDataEntryValue | string | null) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}
