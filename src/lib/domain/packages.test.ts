import { describe, expect, it } from "vitest";
import { addWeeks, barbadosToday, formatEventTime, formatTime, nextWeekday } from "./calendar";
import { activeHolderCount, packageEndDate, packageForSession, remainingClasses, studentPackageStatus, usagePreview, type StudentPackage } from "./packages";

const pkg = (overrides: Partial<StudentPackage> = {}): StudentPackage => ({
  id: "p1", studentId: "a", packageId: "term12", name: "12-Class Term", kind: "class_pack",
  classCount: 12, priceCents: 30000, startDate: "2026-09-22", endDate: "2026-12-15", used: 8, ...overrides,
});

describe("calendar", () => {
  it("uses the Barbados calendar date near midnight UTC", () => {
    expect(barbadosToday(new Date("2026-09-23T02:30:00Z"))).toBe("2026-09-22");
  });
  it("derives term end dates and weekdays", () => {
    expect(addWeeks("2026-09-22", 12)).toBe("2026-12-15");
    expect(nextWeekday("2026-09-23", 2)).toBe("2026-09-29");
    expect(nextWeekday("2026-09-22", 2)).toBe("2026-09-22");
  });
  it("formats times and relative event labels", () => {
    expect(formatTime("19:42")).toBe("7:42 PM");
    expect(formatTime("00:05")).toBe("12:05 AM");
    expect(formatEventTime("2026-09-21", "15:20", "2026-09-22")).toBe("Yesterday, 3:20 PM");
  });
});

describe("packages", () => {
  it("auto-calculates end dates from validity", () => {
    expect(packageEndDate("2026-09-22", 12)).toBe("2026-12-15");
    expect(packageEndDate("2026-09-22", null)).toBeNull();
  });

  it("classifies usage and validity", () => {
    expect(studentPackageStatus(pkg(), "2026-09-22")).toBe("active");
    expect(studentPackageStatus(pkg(), "2026-09-21")).toBe("upcoming");
    expect(studentPackageStatus(pkg(), "2026-12-16")).toBe("expired");
    expect(studentPackageStatus(pkg({ used: 12 }), "2026-10-01")).toBe("used_up");
    expect(remainingClasses(pkg({ classCount: null }))).toBeNull();
  });

  it("draws sessions from the soonest-expiring usable package", () => {
    const packages = [
      pkg({ id: "later", endDate: "2027-01-01" }),
      pkg({ id: "empty", endDate: "2026-10-01", used: 12 }),
      pkg({ id: "soonest", endDate: "2026-11-01" }),
      pkg({ id: "other", studentId: "b", endDate: "2026-10-01" }),
      pkg({ id: "unlimited", kind: "time_based", classCount: null, endDate: null }),
    ];
    expect(packageForSession(packages, "a", "2026-09-22")?.id).toBe("soonest");
    expect(packageForSession(packages, "c", "2026-09-22")).toBeUndefined();
  });

  it("previews the deduction for one session", () => {
    expect(usagePreview(pkg())).toEqual({ usedBefore: 8, usedAfter: 9, total: 12, remainingAfter: 3 });
    expect(usagePreview(pkg({ classCount: null })).remainingAfter).toBeNull();
  });

  it("counts distinct active holders", () => {
    expect(activeHolderCount("term12", [pkg(), pkg({ id: "p2" }), pkg({ id: "p3", studentId: "b", used: 12 })], "2026-09-22")).toBe(1);
  });
});
