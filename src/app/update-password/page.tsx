import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?recovery=expired");

  return <main className="login-page"><UpdatePasswordForm /></main>;
}
