"use client";

import { useActionState } from "react";
import { updatePassword, type UpdatePasswordState } from "@/actions/auth";

const initialState: UpdatePasswordState = { ok: false, message: "" };

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={action} className="login-card">
      <div className="brand login-brand">
          <span className="brand-mark">C</span>
          <span><b>ChalkTab</b><small>Attendance & payments</small></span>
      </div>
      <div>
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        <p className="lede">Use at least 8 characters and keep this password private.</p>
      </div>
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        Confirm new password
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      {state.message && <p className="form-error" role="alert">{state.message}</p>}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
