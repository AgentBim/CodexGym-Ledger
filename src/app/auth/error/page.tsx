import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div>
          <p className="eyebrow">Account recovery</p>
          <h1>Link expired</h1>
          <p className="lede">This reset link is invalid, expired, or has already been used. Request a fresh link and open the newest email.</p>
        </div>
        <Link className="primary auth-link" href="/forgot-password">Request a new link</Link>
        <Link className="auth-link" href="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
