import { z } from "zod";

const id = z.uuid();
const mark = z.enum(["present", "late", "absent"]);
const cents = z.int().min(0).max(100_000_000);
export const uiCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("attendance"), date: z.iso.date(), entries: z.array(z.object({ studentId: id, mark, sessionId: id.nullable(), expectedVersion: z.int().positive().nullable() }).strict()).min(1).max(250) }).strict(),
  z.object({ type: z.literal("createPackage"), definition: z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(200), kind: z.enum(["class_pack", "time_based"]), classCount: z.int().min(1).max(200).nullable(), priceCents: cents, validityWeeks: z.int().min(1).max(520).nullable(), archived: z.boolean() }).strict() }).strict(),
  z.object({ type: z.literal("setPackageArchived"), packageId: id, archived: z.boolean() }).strict(),
  z.object({ type: z.literal("assignPackage"), studentId: id, packageId: id, startDate: z.iso.date(), endDate: z.iso.date().nullable() }).strict(),
  z.object({ type: z.literal("adjustBalance"), studentId: id, deltaCents: z.int().min(-100_000_000).max(100_000_000).refine(v => v !== 0), reason: z.string().trim().min(1).max(200) }).strict(),
  z.object({ type: z.literal("toggleEnrolled"), studentId: id, enrolled: z.boolean(), expectedVersion: z.int().positive() }).strict(),
  z.object({ type: z.literal("saveSchedule"), title: z.string().trim().min(1).max(120), weekday: z.int().min(0).max(6), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), expectedVersion: z.int().min(0) }).strict(),
]);
