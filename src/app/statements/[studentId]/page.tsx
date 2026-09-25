import { StatementActions } from "@/components/statement-actions";
import { loadStudentStatement, StatementNotFoundError } from "@/lib/ledger";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function parameter(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function money(cents: number) {
  return `BBD $${new Intl.NumberFormat("en-BB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100)}`;
}

function standing(balanceCents: number) {
  if (balanceCents > 0) return `${money(balanceCents)} due`;
  if (balanceCents < 0) return `${money(balanceCents)} credit`;
  return "Paid in full";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-BB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function StudentStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
}) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  let statement;
  try {
    statement = await loadStudentStatement({ studentId, from: parameter(query.from), to: parameter(query.to) });
  } catch (error) {
    if (error instanceof StatementNotFoundError) notFound();
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/login");
    throw error;
  }

  const standingClass = statement.closingBalanceCents > 0 ? "due" : statement.closingBalanceCents < 0 ? "credit" : "settled";
  return <main className="statement-page">
    <StatementActions studentName={statement.student.name} statementEnd={statement.to} />
    <article className="statement-document" aria-labelledby="statement-title">
      <header className="statement-header">
        <div className="brand"><span className="brand-mark">C</span><span><b>ChalkTab</b><small>Adult gymnastics ledger</small></span></div>
        <div><p className="eyebrow">Account statement</p><h1 id="statement-title">Statement of account</h1></div>
        <dl><div><dt>Client</dt><dd>{statement.student.name}</dd></div><div><dt>Period</dt><dd>{dateLabel(statement.from)} - {dateLabel(statement.to)}</dd></div><div><dt>Generated</dt><dd>{dateLabel(statement.generatedOn)}</dd></div></dl>
      </header>

      <form className="statement-period-form" method="get">
        <label>From<input type="date" name="from" defaultValue={statement.from} max={statement.to} /></label>
        <label>To<input type="date" name="to" defaultValue={statement.to} min={statement.from} /></label>
        <button className="secondary" type="submit">Update period</button>
      </form>

      <section className={`statement-standing ${standingClass}`} aria-label="Account standing">
        <div><small>Account standing at {dateLabel(statement.to)}</small><strong>{standing(statement.closingBalanceCents)}</strong></div>
        {statement.student.archived && <span>Archived account</span>}
      </section>

      <dl className="statement-summary">
        <div><dt>Opening balance</dt><dd>{standing(statement.openingBalanceCents)}</dd></div>
        <div><dt>Session charges</dt><dd>{money(statement.chargeTotalCents)}</dd></div>
        <div><dt>Payments received</dt><dd>{money(statement.paymentTotalCents)}</dd></div>
        <div className="total"><dt>Closing balance</dt><dd>{standing(statement.closingBalanceCents)}</dd></div>
      </dl>

      <section className="statement-activity" aria-labelledby="statement-activity-title">
        <div className="section-title"><div><p className="eyebrow">Ledger activity</p><h2 id="statement-activity-title">Charges and payments</h2></div><span className="count">{statement.entries.length}</span></div>
        {statement.entries.length ? <div className="statement-table-wrap"><table>
          <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Charge</th><th scope="col">Payment</th><th scope="col">Balance</th></tr></thead>
          <tbody>{statement.entries.map((entry) => <tr key={`${entry.kind}-${entry.id}`}><td>{dateLabel(entry.date)}</td><td>{entry.description}</td><td>{entry.debitCents ? money(entry.debitCents) : "-"}</td><td>{entry.creditCents ? money(entry.creditCents) : "-"}</td><td>{standing(entry.runningBalanceCents)}</td></tr>)}</tbody>
        </table></div> : <div className="empty compact-empty"><b>No account activity in this period</b><p>The opening and closing balances still include eligible prior ledger activity.</p></div>}
      </section>

      <footer className="statement-footer"><p>This statement reflects active held-session charges and active payments recorded in ChalkTab through {dateLabel(statement.to)}. Corrected or voided entries are excluded from the account totals.</p><p>Amounts are shown in Barbados dollars (BBD).</p></footer>
    </article>
  </main>;
}
