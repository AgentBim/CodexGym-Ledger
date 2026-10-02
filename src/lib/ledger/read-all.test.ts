import { expect,it,vi } from "vitest";
import { readAll } from "./read-all";
it("does not truncate financial history at a page boundary",async()=>{
  const rows=Array.from({length:1101},(_,id)=>({id}));
  const page=vi.fn(async(from:number,to:number)=>({data:rows.slice(from,to+1),error:null}));
  expect((await readAll(page)).data).toEqual(rows);
  expect(page).toHaveBeenCalledTimes(3);
});
it("fails closed instead of returning partial financial history",async()=>{
  const page=vi.fn().mockResolvedValueOnce({data:Array(500).fill({id:1}),error:null}).mockResolvedValueOnce({data:null,error:{message:"Connection lost"}});
  expect(await readAll(page)).toEqual({data:null,error:{message:"Connection lost"}});
});
