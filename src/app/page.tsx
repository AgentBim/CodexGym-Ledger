import { ChalkTabApp } from "@/components/chalktab-app";
import { redirect } from "next/navigation";
import { refreshUiLedger } from "@/actions/ui-ledger";
import { createClient } from "@/lib/supabase/server";
export default async function HomePage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  // Supabase's hosted default recovery template can return the PKCE code to the
  // configured Site URL instead of redirectTo. Route that code through the
  // same audited exchange endpoint without rendering or logging it.
  const { code } = await searchParams;
  if (typeof code === "string") {
    const callbackParams = new URLSearchParams({ code, next: "/update-password" });
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <ChalkTabApp data={await refreshUiLedger()} />;
}
