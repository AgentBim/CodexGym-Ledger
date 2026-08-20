"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signInWithGoogle, type SignInState } from "../actions/auth";

const initialSignInState: SignInState = { ok: false, message: "", email: "" };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, initialSignInState);

  return (
    <section className="login-card" aria-labelledby="sign-in-heading">
      <div className="brand login-brand">
          <span className="brand-mark">C</span>
          <span><b>ChalkTab</b><small>Attendance & payments</small></span>
      </div>
      <div>
        <p className="eyebrow">Secure ledger</p>
        <h1 id="sign-in-heading">Sign in</h1>
        <p className="lede">Choose Google or sign in with your ChalkTab password.</p>
      </div>
      {notice && <p className="form-success" role="status">{notice}</p>}
      <form action={signInWithGoogle} className="auth-method-form">
        <button className="google-sign-in" type="submit">
          <span aria-hidden="true">G</span> Continue with Google
        </button>
      </form>
      <div className="auth-divider"><span>or use your password</span></div>
      <form action={action} className="password-sign-in">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" defaultValue={state.ok ? "" : state.email} required />
        </label>
        <label>
          <span className="label-row">Password <Link href="/forgot-password">Forgot password?</Link></span>
          <input name="password" type="password" autoComplete="current-password" minLength={8} required />
        </label>
        {state.message && <p className="form-error" role="alert">{state.message}</p>}
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in with password"}
        </button>
      </form>
    </section>
  );
}
