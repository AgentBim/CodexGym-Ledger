import { addWeeks } from "./calendar";

export type PackageKind = "class_pack" | "time_based";

/** A term or credit bundle the gym sells, e.g. "12-Class Term". */
export type PackageDefinition = {
  id: string;
  name: string;
  description: string;
  kind: PackageKind;
  /** Classes included; null for time-based (unlimited within validity). */
  classCount: number | null;
  priceCents: number;
  /** Null means the package never expires. */
  validityWeeks: number | null;
  archived: boolean;
};

/** A package assigned to one student. Name, size and price are copied so later edits never rewrite history. */
export type StudentPackage = {
  id: string;
  studentId: string;
  packageId: string;
  name: string;
  kind: PackageKind;
  classCount: number | null;
  priceCents: number;
  startDate: string;
  endDate: string | null;
  used: number;
};

export type StudentPackageStatus = "active" | "upcoming" | "used_up" | "expired";

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-BB", { style: "currency", currency: "BBD" }).format(Math.abs(cents) / 100).replace("BBD", "$");
}

export function packageEndDate(startDate: string, validityWeeks: number | null) {
  return validityWeeks === null ? null : addWeeks(startDate, validityWeeks);
}

/** Null when the package is unlimited (time-based). */
export function remainingClasses(pkg: Pick<StudentPackage, "classCount" | "used">) {
  return pkg.classCount === null ? null : Math.max(pkg.classCount - pkg.used, 0);
}

export function studentPackageStatus(pkg: StudentPackage, date: string): StudentPackageStatus {
  if (pkg.endDate !== null && date > pkg.endDate) return "expired";
  if (remainingClasses(pkg) === 0) return "used_up";
  if (date < pkg.startDate) return "upcoming";
  return "active";
}

/**
 * The package a session on `date` should draw from: usable on that date,
 * soonest-expiring first so credits are not wasted, then oldest first.
 */
export function packageForSession(packages: readonly StudentPackage[], studentId: string, date: string) {
  return packages
    .filter((pkg) => pkg.studentId === studentId && studentPackageStatus(pkg, date) === "active")
    .sort((a, b) => (a.endDate ?? "9999-12-31").localeCompare(b.endDate ?? "9999-12-31") || a.startDate.localeCompare(b.startDate))[0];
}

export function usagePreview(pkg: Pick<StudentPackage, "classCount" | "used">) {
  const after = { classCount: pkg.classCount, used: pkg.used + 1 };
  return { usedBefore: pkg.used, usedAfter: after.used, total: pkg.classCount, remainingAfter: remainingClasses(after) };
}

/** Number of students currently holding an active copy of a package definition. */
export function activeHolderCount(packageId: string, packages: readonly StudentPackage[], date: string) {
  return new Set(packages.filter((pkg) => pkg.packageId === packageId && studentPackageStatus(pkg, date) === "active").map((pkg) => pkg.studentId)).size;
}

export function classCountLabel(classCount: number | null) {
  return classCount === null ? "Unlimited classes" : `${classCount} ${classCount === 1 ? "class" : "classes"}`;
}

export function validityLabel(validityWeeks: number | null) {
  return validityWeeks === null ? "No expiry" : `Valid ${validityWeeks} ${validityWeeks === 1 ? "week" : "weeks"}`;
}
