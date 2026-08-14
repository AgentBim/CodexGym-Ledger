"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(8).max(1024),
});

export type SignInState =
  | { ok: false; message: string; email: string }
  | { ok: true; message: "Signed in" };

export type PasswordResetState = { ok: boolean; message: string; email: string };
export type UpdatePasswordState = { ok: false; message: string };

/** Server action contract for React useActionState; intentionally offers no sign-up path. */
export async function signIn(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const submittedEmail = formData.get("email");
    return {
      ok: false,
      message: "Enter a valid email address and password.",
      email: typeof submittedEmail === "string" ? submittedEmail.trim().slice(0, 254) : "",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      message: "The email address or password is incorrect.",
      email: parsed.data.email,
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function signInWithGoogle(): Promise<never> {
  const origin = await getTrustedOrigin();
  if (!origin) redirect("/auth/error");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) redirect("/auth/error");
  redirect(data.url);
}

const emailSchema = z.email().trim().max(254);

async function getTrustedOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) return null;

  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : hostname === "localhost" || hostname === "127.0.0.1"
      ? "http"
      : "https";

  return `${protocol}://${host}`;
}

/** Returns a generic success message so coach accounts cannot be enumerated. */
export async function requestPasswordReset(
  _previousState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  if (!parsedEmail.success) return { ok: false, message: "Enter a valid email address.", email: "" };

  const origin = await getTrustedOrigin();
  if (!origin) {
    return { ok: false, message: "Password recovery is temporarily unavailable. Please try again.", email: parsedEmail.data };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  return {
    ok: true,
    message: "If that coach account exists, a password reset link has been sent. Open it on this device.",
    email: parsedEmail.data,
  };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8).max(1024),
    confirmPassword: z.string().min(8).max(1024),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "The passwords do not match.",
  });

export async function updatePassword(
  _previousState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.some((issue) => issue.message === "The passwords do not match.")
        ? "The passwords do not match."
        : "Use a password with at least 8 characters.",
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "This recovery session has expired. Request a new reset link." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: "The password could not be updated. Request a new reset link and try again." };

  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/login?passwordUpdated=1");
}
