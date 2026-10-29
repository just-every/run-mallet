import {balanceReminderReview} from './receivables'
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State} from './model'
import {instant} from './workshop'

export const balancePlanCommands=['ar.saveBalanceReviewPolicy','ar.planBalanceReviews','ar.stopBalanceReviews']
export const balanceReviewPolicy=(s:State)=>rows(s,'balanceReviewPolicy').sort((a,b)=>a.revision-b.revision).at(-1)
export const balanceReviewPlans:Handler=(c,command,p)=>{
 if(!balancePlanCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages balance review plans.',null,403)
 if(command==='ar.saveBalanceReviewPolicy'){
  const previous=balanceReviewPolicy(c.s)
  if(previous){expectVersion(previous,p.version);if(previous.id!==p.id)fail('AR_POLICY','Review the current policy revision before replacing it.')}
  const days=Array.isArray(p.days)?p.days.map((d:unknown)=>integer(d,'review day after plan start',0,30)):fail('INPUT','List review days.',null,400)
  if(!days.length||days.length>8||days.some((d:number,i:number)=>i>0&&d<=days[i-1]))fail('INPUT','Use up to eight increasing review days within thirty days.',null,400)
  const row=put(c.s,'balanceReviewPolicy',{revision:(previous?.revision??0)+1,previousId:previous?.id??null,name:text(p.name,'review policy name'),days,evidence:text(p.evidence,'reason for the policy revision',2000),by:who(c),at:c.now})
  event(c,command,null,row.id,{});return row
 }
 if(command==='ar.stopBalanceReviews'){
  const row=find(c.s,'balanceReviewPlan',p.id);expectVersion(row,p.version)
  if(row.stoppedAt)fail('AR_PLAN_STOPPED','This review plan is already stopped.')
  const stopped=bump(c.s,'balanceReviewPlan',row,{stoppedAt:c.now,stoppedBy:who(c),stopReason:text(p.reason,'stop reason',2000)})
  event(c,command,row.jobId,row.id,{});return stopped
 }
 const policy=balanceReviewPolicy(c.s)
 if(!policy||policy.id!==p.policyId||policy.revision!==p.policyRevision)fail('AR_POLICY','Select the current balance review policy.')
 if(p.confirm!=='plan-balance-reviews')fail('AR_PLAN_CONFIRM','Confirm that this plan creates internal reviews, with no email approval.',null,400)
 const checked=balanceReminderReview(c.s,c.actor,{...p,confirm:'send-balance-reminder',consent:true},c.now),invoice=checked.invoice
 if(rows(c.s,'retentionReceipt').some(r=>r.action==='customer.erase'&&r.customerId===checked.accountId))fail('AR_ERASURE','This erased account has no new balance outreach authority.')
 if(rows(c.s,'balanceReviewPlan').some(r=>r.invoiceId===invoice.id&&!r.stoppedAt&&r.by.id===c.actor.id))fail('AR_PLAN_ACTIVE','Stop the existing review plan before replacing it.')
 const startAt=instant(p.startAt,'review plan start'),steps=policy.days.map((day:number,i:number)=>({n:i+1,day,dueAt:new Date(Date.parse(startAt)+day*86400000).toISOString()}))
 const row=put(c.s,'balanceReviewPlan',{invoiceId:invoice.id,invoiceVersion:invoice.version,accountId:checked.accountId,jobId:invoice.jobId,termsId:checked.terms.id,assignmentId:checked.item.terms!.id,contactId:checked.contact.id,contactVersion:checked.contact.version,to:checked.contact.email,policy:structuredClone(policy),startAt,steps,evidence:text(p.evidence,'reason for these internal reviews',2000),by:who(c),at:c.now,stoppedAt:null})
 event(c,command,invoice.jobId,row.id,{});return row
}
/** A task is only an internal reminder to review. It cannot approve even one email. */
export function approvedBalanceReviewStep(s:State,actorId:string,p:any,checked:any,now:string){
 if(!p.reviewPlanId)return {}
 const plan=find(s,'balanceReviewPlan',p.reviewPlanId);expectVersion(plan,p.reviewPlanVersion)
 const step=plan.steps.find((r:any)=>r.n===p.reviewStep)
 if(plan.by.id!==actorId||plan.stoppedAt||!step||step.dueAt>now||plan.invoiceId!==checked.invoice.id||plan.invoiceVersion!==checked.invoice.version||plan.termsId!==checked.terms.id||plan.assignmentId!==checked.item.terms?.id||plan.contactId!==checked.contact.id||plan.contactVersion!==checked.contact.version||plan.to!==checked.contact.email)fail('AR_PLAN_REVIEW','Review a due step against current owner authority and the exact invoice, terms and recipient.')
 if(rows(s,'outreach').some(r=>r.reviewPlanId===plan.id&&r.reviewStep===step.n))fail('AR_PLAN_USED','This review step already approved one schedule. Its history cannot authorize another attempt.')
 return {reviewPlanId:plan.id,reviewPlanVersion:plan.version,reviewStep:step.n}
}
