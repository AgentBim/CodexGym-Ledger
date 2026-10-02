"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { uiCommandSchema } from "@/lib/validation/ui-command";
import { loadLedgerDashboard } from "@/lib/ledger/load-dashboard";
import { loadUiSnapshot } from "@/lib/ledger/load-ui";
import { withAdjustments } from "@/lib/ledger/with-adjustments";
import type { MutationResult } from "./ledger";

export async function runUiCommand(input: unknown): Promise<MutationResult> {
  const parsed = z.object({ key: z.uuid(), command: uiCommandSchema }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: "Check the dates, amounts and required fields." };
  let auth;
  try { auth = await requireUser(); } catch { return { ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." }; }
  const { key, command } = parsed.data;
  const { data, error } = await auth.supabase.rpc("ui_command", {
    p_key: key, p_hash: createHash("sha256").update(JSON.stringify(command)).digest("hex"), p_command: command,
  });
  if (error) return { ok: false, code: error.message.includes("stale_operation") ? "CONFLICT" : error.code?.startsWith("23") || error.message.includes("invalid_") ? "INVALID" : "DATABASE", message: error.message.includes("stale_operation") ? "This record changed. Refresh and review before saving again." : "Save not confirmed. Check your inputs and retry." };
  return { ok: true, data };
}

export async function refreshUiLedger() {
  const [dashboard, extra] = await Promise.all([loadLedgerDashboard(), loadUiSnapshot()]);
  return { dashboard: withAdjustments(dashboard, extra.adjustments), extra };
}
