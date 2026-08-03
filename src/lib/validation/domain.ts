import { z } from "zod";

const money = z.coerce.number().finite().nonnegative().max(100_000);
const isoDate = z.iso.date();

export const studentInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  defaultRate: money.default(30),
  notes: z.string().trim().max(2_000).optional(),
  status: z.enum(["active", "archived"]).default("active"),
}).strict();

export const sessionInputSchema = z.object({
  studentId: z.uuid(),
  date: isoDate,
  status: z.enum(["scheduled", "held", "canceled", "no-show"]),
}).strict();

export const paymentInputSchema = z.object({
  studentId: z.uuid(),
  date: isoDate,
  amount: money.positive(),
  method: z.enum(["cash", "transfer", "other"]),
}).strict();

export type StudentInput = z.infer<typeof studentInputSchema>;
export type SessionInput = z.infer<typeof sessionInputSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;

