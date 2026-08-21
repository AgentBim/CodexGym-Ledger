"use client";

import { useEffect } from "react";
import Link from "next/link";

export function StatementActions({ studentName, statementEnd }: { studentName: string; statementEnd: string }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${studentName} account statement ${statementEnd}`;
    return () => { document.title = previousTitle; };
  }, [statementEnd, studentName]);

  return <div className="statement-toolbar" aria-label="Statement actions">
    <Link className="secondary statement-link" href="/?view=students">Back to ChalkTab</Link>
    <button className="primary" type="button" onClick={() => window.print()}>Print / Save PDF</button>
  </div>;
}
