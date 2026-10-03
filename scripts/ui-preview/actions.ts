import { uiFixture } from "../../src/test-fixtures/ui-ledger";
import type { MutationResult } from "../../src/actions/ledger";
const readOnly=async():Promise<MutationResult>=>({ok:false,code:"INVALID",message:"Local visual check uses synthetic data. Server writes are disabled."});
export const logPayment=readOnly,saveStudent=readOnly,undoOperation=readOnly,runUiCommand=readOnly;
export async function refreshUiLedger(){return uiFixture();}
export async function signOut(){}
