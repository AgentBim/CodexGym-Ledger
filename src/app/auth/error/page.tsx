import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const isReset = reason === "reset";

  return (
    <main className="login-page">
      <section className="login-card">
        <div>
          <p className="eyebrow">{isReset ? "Account recovery" : "Sign in"}</p>
          <h1>{isReset ? "Link expired" : "Sign-in failed"}</h1>
          <p className="lede">
            {isReset
              ? "This reset link is invalid, expired, or has already been used. Request a fresh link and open the newest email."
              : "We couldn't complete that sign-in. Try again, or use your email and password instead."}
          </p>
        </div>
        {isReset
          ? <Link className="primary auth-link" href="/forgot-password">Request a new link</Link>
          : <Link className="primary auth-link" href="/login">Try again</Link>}
        <Link className="auth-link" href="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
