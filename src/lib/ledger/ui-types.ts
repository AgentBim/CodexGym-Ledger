import type { PackageDefinition, StudentPackage } from "@/lib/domain/packages";

export type Adjustment = { id: string; student_id: string; entry_date: string; amount_cents: number; reason: string; created_at: string };
export type UiSnapshot = {
  packages: PackageDefinition[];
  studentPackages: StudentPackage[];
  adjustments: Adjustment[];
  enrollments: { id: string; enrolled: boolean | null; version: number }[];
  attendance: { id: string; mark: "present" | "late" | "absent" | null; packageId: string | null }[];
  schedule: { title: string; weekday: number; start: string; end: string; version: number } | null;
};
