import { describe,it,expect } from "vitest";
import { withAdjustments } from "./with-adjustments";
import { uiFixture } from "../../test-fixtures/ui-ledger";
import { buildAccountStatementLedger } from "../domain/statement";
describe("package charges and credits",()=>{
  it("uses the same signed entries for balances and statements",()=>{
    const data=uiFixture().dashboard; const student=data.students[1]!;
    const entries=[{id:"charge",student_id:student.id,entry_date:"2026-10-01",amount_cents:6000,reason:"Package: term",created_at:"2026-10-01T12:00:00Z"},{id:"credit",student_id:student.id,entry_date:"2026-10-02",amount_cents:-2000,reason:"Correction",created_at:"2026-10-02T12:00:00Z"}];
    const dashboard=withAdjustments(data,entries);
    const statement=buildAccountStatementLedger({from:"2026-10-02",to:"2026-10-02",sessions:[],payments:[],adjustments:entries});
    expect(statement.openingBalanceCents).toBe(6000);
    expect(statement.closingBalanceCents).toBe(4000);
    expect(dashboard.studentSummaries[1]?.balanceCents).toBe(statement.closingBalanceCents);
    expect(dashboard.studentSummaries[1]?.overdue).toBe(true);
    expect(withAdjustments(data,[...entries,{...entries[1]!,id:"more-credit",amount_cents:-4000}]).studentSummaries[1]?.overdue).toBe(false);
  });
});
