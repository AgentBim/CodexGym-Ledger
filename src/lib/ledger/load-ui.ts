import "server-only";
import { requireUser } from "@/lib/supabase/server";
import type { UiSnapshot } from "./ui-types";

export async function loadUiSnapshot(): Promise<UiSnapshot> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("ui_snapshot");
  if (error || !data) throw new Error("The updated ledger could not be loaded. Check that the UI migration is installed.");
  return data as unknown as UiSnapshot;
}
