import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordUpdated?: string; recovery?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  const params = await searchParams;
  const notice = params.passwordUpdated === "1"
    ? "Password updated. Sign in with your new password."
    : params.recovery === "expired"
      ? "That recovery session is missing or expired. Request a new reset link."
      : undefined;

  return <main className="login-page"><LoginForm notice={notice} /></main>;
}
