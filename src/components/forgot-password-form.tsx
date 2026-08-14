"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type PasswordResetState } from "@/actions/auth";

const initialState: PasswordResetState = { ok: false, message: "", email: "" };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={action} className="login-card">
      <div className="brand login-brand">
          <span className="brand-mark">C</span>
          <span><b>ChalkTab</b><small>Attendance & payments</small></span>
      </div>
      <div>
        <p className="eyebrow">Account recovery</p>
        <h1>Reset password</h1>
        <p className="lede">We’ll email a secure one-time link to the coach account.</p>
      </div>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" defaultValue={state.email} required />
      </label>
      {state.message && (
        <p className={state.ok ? "form-success" : "form-error"} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <Link className="auth-link" href="/login">Back to sign in</Link>
    </form>
  );
}
