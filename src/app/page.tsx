import { AdultAdminApp } from "@/components/adult-admin-app";
import { redirect } from "next/navigation";
import { loadLedgerDashboard, toAdultAdminReadModel } from "@/lib/ledger";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[]; view?: string | string[]; date?: string | string[]; tab?: string | string[]; student?: string | string[]; type?: string | string[]; from?: string | string[]; to?: string | string[] }>;
}) {
  // Supabase's hosted default recovery template can return the PKCE code to the
  // configured Site URL instead of redirectTo. Route that code through the
  // same audited exchange endpoint without rendering or logging it.
  const { code, view, date, tab, student, type, from, to } = await searchParams;
  if (typeof code === "string") {
    const callbackParams = new URLSearchParams({ code, next: "/update-password" });
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const selectedDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : undefined;
  const dashboard = await loadLedgerDashboard(selectedDate ? { today: selectedDate, periodEnd: selectedDate } : undefined);
  return <AdultAdminApp data={toAdultAdminReadModel(dashboard)} initialView={view === "activity" ? "activity" : undefined} initialActivityTab={tab === "day" ? "day" : "timeline"} initialTimelineFilters={{ student: typeof student === "string" ? student : undefined, type: typeof type === "string" ? type : undefined, from: typeof from === "string" ? from : undefined, to: typeof to === "string" ? to : undefined }} />;
}
