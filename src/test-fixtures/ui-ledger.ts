import type { UiLedgerData } from "@/components/chalktab/projection";

/** Synthetic data used only by tests and the separate local visual harness. */
export function uiFixture(): UiLedgerData {
  const students=["Alex Sample","Blair Sample","Casey Sample","Drew Sample"].map((name,i)=>({
    id:`10000000-0000-4000-8000-00000000000${i}`, name, defaultRateCents:3000, notes:null,
    archivedAt:null,version:1,createdAt:"2026-07-01T12:00:00Z",updatedAt:"2026-07-01T12:00:00Z",
  }));
  return {dashboard:{user:{id:"20000000-0000-4000-8000-000000000000",email:"coach@example.test"},today:"2026-10-02",students,
    studentSummaries:students.map((s,i)=>({...s,balanceCents:[-6000,0,6000,3000][i]!,balanceState:i===0?"credit":i===1?"settled":i===2?"overdue":"owed",overdue:i===2,lastHeldOn:null,todaySession:null})),
    sessions:[],payments:[],templates:[],auditEvents:[],dailyReviews:[],
    period:{startDate:"2026-10-01",endDate:"2026-10-02",collectedCents:0,totalOwedCents:9000,totalCreditCents:6000,attendance:{scheduled:0,held:0,canceled:0,no_show:0}},
    dayRecap:{date:"2026-10-02",collectedCents:0,attendance:{scheduled:0,held:0,canceled:0,no_show:0},reviewedAt:null,overdueStudentCount:1}},
    extra:{packages:[{id:"30000000-0000-4000-8000-000000000000",name:"12-Class Term",description:"Twelve weekly classes",kind:"class_pack",classCount:12,priceCents:30000,validityWeeks:12,archived:false}],studentPackages:[],adjustments:[],
      enrollments:students.map(s=>({id:s.id,enrolled:true,version:1})),attendance:[],schedule:{title:"Adult Gymnastics",weekday:5,start:"19:00",end:"20:30",version:1}}};
}
