import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'
import {linkState} from './approval-links'
// EST-006: owner/admin set when approval links expire and when reminders go; a scheduled sweep
// reminds only the current undecided link, stops on decision/reply/opt-out and hands failures to an advisor.
export const chaseCommands=['chasePolicy.save','approvalChase.recordReply','chaseOptOut.record','chaseOptOut.lift','chaseTask.resolve'] as const
export const internalChaseCommands=['approvalChase.sweep','approvalChase.outcome','chaseOptOut.customer']
export const DEFAULT_POLICY={linkDays:7,reminderDays:[2,5]}
const DAY=86_400_000,failed=['rejected','rate_limited','uncertain','unavailable']
const advisor=(c:Context)=>{if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','An owner or service advisor manages approval chasing.',null,403)}
export const chasePolicy=(s:State)=>rows(s,'chasePolicy')[0]??null
export const policyOf=(s:State)=>chasePolicy(s)??DEFAULT_POLICY
const address=(value:unknown)=>{const email=text(value,'customer email',320).toLowerCase();if(!/^[^\s@]+@[^\s@]+$/.test(email))fail('INPUT','Enter the customer’s email address.',null,400);return email}
export const optedOut=(s:State,email:string)=>rows(s,'chaseOptOut').find(o=>o.email===email.toLowerCase()&&!o.liftedAt)
export function openTask(c:Context,link:Row,kind:'delivery-failed'|'unanswered',detail:string) {
 return put(c.s,'chaseTask',{jobId:link.jobId,linkId:link.id,estimateId:link.estimateId,revision:link.revision,to:link.to,kind,detail,openedAt:c.now,resolvedAt:null,resolvedBy:null,note:null})
}
/** Each sent link snapshots the policy: reminders strictly before expiry, in whole days after the send (UTC instants). */
export function startChase(c:Context,link:Row) {
 const policy=policyOf(c.s),sent=Date.parse(link.createdAt)
 const steps=policy.reminderDays.map((day:number,i:number)=>({n:i+1,day,dueAt:new Date(sent+day*DAY).toISOString(),status:'pending',at:null,provider:null,providerMessageId:null})).filter((step:any)=>step.dueAt<link.expiresAt)
 const chase=put(c.s,'approvalChase',{linkId:link.id,jobId:link.jobId,estimateId:link.estimateId,revision:link.revision,to:link.to,expiresAt:link.expiresAt,policy:{linkDays:Math.round((Date.parse(link.expiresAt)-sent)/DAY),reminderDays:policy.reminderDays},steps,stoppedAt:null,stopReason:null,stoppedBy:null,note:null,unansweredAt:null})
 return optedOut(c.s,link.to)?stop(c,chase,'opt-out'):chase
}
/** Stops the chase of one link at once (decision, revocation or a failed first send); the sweep catches the rest before any send. */
export function stopFor(c:Context,linkId:string,reason:string) {
 const chase=rows(c.s,'approvalChase').find(x=>x.linkId===linkId&&!x.stoppedAt)
 if(chase)stop(c,chase,reason)
}
function stop(c:Context,chase:Row,reason:string,note:string|null=null) {
 const next=bump(c.s,'approvalChase',chase,{stoppedAt:c.now,stopReason:reason,stoppedBy:who(c),note,steps:chase.steps.map((s:any)=>s.status==='pending'?{...s,status:'skipped'}:s)})
 event(c,'approvalChase.stop',chase.jobId,chase.id,{reason,revision:chase.revision});return next
}
/** Why a running chase must stop now, or null while its link is still the current undecided revision. */
function stopReason(c:Context,chase:Row,link:Row):string|null {
 if(link.decision)return 'decision'
 if(link.revokedAt)return 'revoked'
 if(optedOut(c.s,chase.to))return 'opt-out'
 const estimate=find(c.s,'estimate',chase.estimateId)
 if(estimate.authorisation)return 'decision'
 if(linkState(c.s,link,c.now)==='active')return null
 return link.expiresAt<=c.now?'expired':'superseded'
}
export const approvalChasing:Handler=(c,command,p)=>{
 if(!(chaseCommands as readonly string[]).includes(command)&&!internalChaseCommands.includes(command))return
 if(command==='chaseOptOut.customer') {
  const link=find(c.s,'approvalLink',p.linkId),email=link.to.toLowerCase(),existing=optedOut(c.s,email)
  if(existing)return existing
  const row=put(c.s,'chaseOptOut',{email,source:'customer link',linkId:link.id,note:'The customer chose Stop reminders on their approval link.',recordedBy:who(c),at:c.now,liftedAt:null,liftedBy:null,liftReason:null})
  for(const chase of rows(c.s,'approvalChase').filter(x=>!x.stoppedAt&&x.to.toLowerCase()===email))stop(c,chase,'opt-out')
  event(c,'chaseOptOut.record',null,row.id,{source:row.source});return row
 }
 if(command==='approvalChase.sweep'||command==='approvalChase.outcome') {
  if(c.actor.role!=='system')fail('FORBIDDEN','Only the scheduled reminder service records this.',null,403)
  if(command==='approvalChase.outcome') {
   // The provider's answer is kept as given: accepted means handed to the provider, never delivered. No automatic retry.
   const chase=find(c.s,'approvalChase',p.chaseId),n=integer(p.step,'step',1,10),status=choice(p.status,['accepted','development',...failed] as const,'delivery status')
   const step=chase.steps.find((s:any)=>s.n===n);if(step?.status!=='claimed')fail('STEP_STATE','This reminder was not claimed.')
   const next=bump(c.s,'approvalChase',chase,{steps:chase.steps.map((s:any)=>s.n===n?{...s,status,provider:text(p.provider,'provider',100),providerMessageId:p.providerMessageId?text(p.providerMessageId,'provider message id',300):null,at:c.now}:s)})
   event(c,'approvalChase.reminder',chase.jobId,chase.id,{step:n,status})
   if(failed.includes(status))openTask(c,find(c.s,'approvalLink',chase.linkId),'delivery-failed',`Reminder ${n} ${status==='unavailable'?'could not be sent: no mail sender is configured':status==='uncertain'?'has an uncertain mail outcome; it was not retried':`was ${status.replace('_',' ')} by the mail provider`}.`)
   return next
  }
  // One claim per due step precedes its one provider call; an overdue run sends only the latest due step.
  const claims:any[]=[]
  // An opt-out stops emails, not follow-up: an opted-out estimate that expires undecided still reaches an advisor.
  for(const chase of rows(c.s,'approvalChase').filter(x=>!x.stoppedAt||x.stopReason==='opt-out'&&!x.unansweredAt)) {
   const link=find(c.s,'approvalLink',chase.linkId),unanswered=()=>openTask(c,link,'unanswered',(n=>`Revision ${chase.revision} expired undecided after ${n?n===1?'one reminder':n+' reminders':'no reminders'}.`)(chase.steps.filter((s:any)=>!['pending','skipped'].includes(s.status)).length))
   if(chase.stoppedAt){if(link.expiresAt<=c.now&&linkState(c.s,link,new Date(Date.parse(link.expiresAt)-1).toISOString())==='active'){bump(c.s,'approvalChase',chase,{unansweredAt:c.now});unanswered()}continue}
   const reason=stopReason(c,chase,link)
   if(reason){const stopped=stop(c,chase,reason);if(reason==='expired'){bump(c.s,'approvalChase',stopped,{unansweredAt:c.now});unanswered()}continue}
   const due=chase.steps.filter((s:any)=>s.status==='pending'&&s.dueAt<=c.now)
   if(!due.length)continue
   const last=due.at(-1).n
   const next=bump(c.s,'approvalChase',chase,{steps:chase.steps.map((s:any)=>s.status==='pending'&&s.dueAt<=c.now?{...s,status:s.n===last?'claimed':'skipped',at:c.now}:s)})
   claims.push({chaseId:next.id,step:last,linkId:link.id,jobId:link.jobId,to:link.to,expiresAt:link.expiresAt})
  }
  return claims
 }
 advisor(c)
 if(command==='chasePolicy.save') {
  const linkDays=integer(p.linkDays,'link lifetime in days',1,30),days=Array.isArray(p.reminderDays)?p.reminderDays.map((d:unknown)=>integer(d,'reminder day',1,29)):fail('INPUT','List reminder days.',null,400)
  if(days.length>3||days.some((d:number,i:number)=>i&&d<=days[i-1])||days.some((d:number)=>d>=linkDays))fail('INPUT','Use up to three increasing reminder days, each before the link expires.',null,400)
  const current=chasePolicy(c.s),value={linkDays,reminderDays:days,savedBy:who(c),savedAt:c.now}
  if(current)expectVersion(current,p.version)
  const row=current?bump(c.s,'chasePolicy',current,{...value,history:[...current.history,{linkDays:current.linkDays,reminderDays:current.reminderDays,savedBy:current.savedBy,savedAt:current.savedAt}]}):put(c.s,'chasePolicy',{...value,history:[]})
  event(c,command,null,row.id,{linkDays,reminderDays:days});return row
 }
 if(command==='approvalChase.recordReply') {
  const chase=find(c.s,'approvalChase',p.chaseId);expectVersion(chase,p.version)
  if(chase.stoppedAt)fail('CHASE_STATE','Reminders for this link already stopped.')
  return stop(c,chase,'reply',text(p.note,'what the customer said',500))
 }
 if(command==='chaseOptOut.record') {
  const email=address(p.email)
  if(optedOut(c.s,email))fail('OPTED_OUT','This customer already opted out of reminders.')
  const row=put(c.s,'chaseOptOut',{email,source:'staff',linkId:null,note:text(p.note,'how the customer asked',500),recordedBy:who(c),at:c.now,liftedAt:null,liftedBy:null,liftReason:null})
  for(const chase of rows(c.s,'approvalChase').filter(x=>!x.stoppedAt&&x.to.toLowerCase()===email))stop(c,chase,'opt-out')
  event(c,command,null,row.id,{source:row.source});return row
 }
 if(command==='chaseOptOut.lift') {
  const row=find(c.s,'chaseOptOut',p.optOutId);expectVersion(row,p.version)
  if(row.liftedAt)fail('CHASE_STATE','This opt-out was already lifted.')
  const next=bump(c.s,'chaseOptOut',row,{liftedAt:c.now,liftedBy:who(c),liftReason:text(p.reason,'how the customer asked to resume',500)})
  event(c,command,null,row.id,{reason:next.liftReason});return next
 }
 const task=find(c.s,'chaseTask',p.taskId);expectVersion(task,p.version)
 if(task.resolvedAt)fail('TASK_STATE','This task is already resolved.')
 return bump(c.s,'chaseTask',task,{resolvedAt:c.now,resolvedBy:who(c),note:text(p.note,'what the advisor did',500)})
}
