import {bump,choice,event,expectVersion,fail,find,put,rows,text,who,type Context,type State} from './model'
export const webhookFamilies=['booking','inspection','approval','parts','status','invoice','payment'] as const
export const webhookCommands=['webhook.subscribe','webhook.stop','webhook.replay','webhook.claim','webhook.outcome']
export const internalWebhookCommands=['webhook.claim','webhook.outcome']
export function webhookFamily(kind:string):string|null {
 if(kind==='job.book'||kind.startsWith('booking.'))return 'booking'
 if(kind.startsWith('inspection.'))return 'inspection'
 if(['estimate.authorise','estimate.customerDecide'].includes(kind))return 'approval'
 if(/^(stock|purchase|supplierOrder|specialPart)\./.test(kind))return 'parts'
 if(/^(flow|job|work|dispatch)\./.test(kind))return 'status'
 if(kind.startsWith('invoice.'))return 'invoice'
 if(/^(payment|stripePayment)\./.test(kind))return 'payment'
 return null
}
/** Called inside the business transaction. No customer fields or bearer material cross this boundary. */
export function retainWebhookEvent(c:Context,source:any){
 const family=webhookFamily(source.kind);if(!family)return
 for(const subscription of rows(c.s,'webhookSubscription').filter(s=>s.active&&s.families.includes(family))){
  const delivery=put(c.s,'webhookDelivery',{subscriptionId:subscription.id,eventId:source.id,family,status:'pending',attempts:0,cycleAttempts:0,dueAt:c.now,history:[],at:c.now})
  delivery.envelope={event_id:source.id,input:{schema_version:1,type:source.kind,family,subject_id:source.subjectId,job_id:source.jobId,occurred_at:source.at}}
 }
}
export function webhooks(c:Context,command:string,p:any){
 if(!webhookCommands.includes(command))return
 if(!internalWebhookCommands.includes(command)&&c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages webhooks.',null,403)
 if(command==='webhook.subscribe'){
  if(p.consent!==true)fail('CONSENT','Explicit endpoint and event-family approval is required.',null,400)
  if(!Array.isArray(p.families)||!p.families.length||p.families.length>7)fail('INPUT','Select event families.',null,400)
  const families=[...new Set(p.families.map((f:any)=>choice(f,webhookFamilies,'event family')))];
  const row=put(c.s,'webhookSubscription',{label:text(p.label,'label',100),families,active:true,by:who(c),at:c.now,consentEvidence:text(p.consentEvidence,'approval evidence',2000)})
  event(c,command,null,row.id,{families});return row
 }
 if(command==='webhook.stop'){
  const row=find(c.s,'webhookSubscription',p.id);expectVersion(row,p.version)
  const next=bump(c.s,'webhookSubscription',row,{active:false});event(c,command,null,row.id,{reason:text(p.reason,'reason',2000)});return next
 }
 const row=find(c.s,'webhookDelivery',p.id);expectVersion(row,p.version)
 if(command==='webhook.replay'){
  if(row.status==='claimed'||row.status==='pending')fail('STATE','Only a completed or stopped attempt can be replayed.')
  const subscription=find(c.s,'webhookSubscription',row.subscriptionId);if(!subscription.active)fail('STATE','The subscription is stopped.')
  const reason=text(p.reason,'replay reason',2000),next=bump(c.s,'webhookDelivery',row,{status:'pending',cycleAttempts:0,dueAt:c.now,claimId:null,history:[...row.history,{action:'replay',by:who(c),at:c.now,reason}]})
  event(c,command,null,row.id,{reason,eventId:row.eventId});return next
 }
 if(command==='webhook.claim'){
  if(row.status==='claimed'){
   if(Date.parse(c.now)-Date.parse(row.claimedAt)<60000)fail('STATE','The delivery is already claimed.')
   return bump(c.s,'webhookDelivery',row,{status:'uncertain',history:[...row.history,{action:'interrupted',at:c.now}]})
  }
  if(row.status!=='pending'||row.dueAt>c.now||row.cycleAttempts>=3)fail('STATE','The delivery is not eligible.')
  return bump(c.s,'webhookDelivery',row,{status:'claimed',claimedAt:c.now,claimId:crypto.randomUUID(),attempts:row.attempts+1,cycleAttempts:row.cycleAttempts+1})
 }
 if(row.status!=='claimed'||row.claimId!==p.claimId)fail('STATE','The claim changed.')
 const outcome=choice(p.outcome,['delivered','retry','failed','uncertain','blocked'],'delivery outcome'),status=outcome==='retry'?(row.cycleAttempts<3?'pending':'failed'):outcome
 return bump(c.s,'webhookDelivery',row,{status,dueAt:new Date(Date.parse(c.now)+60000*2**(row.cycleAttempts-1)).toISOString(),history:[...row.history,{action:'attempt',at:c.now,status,httpStatus:p.httpStatus??null,keyVersion:p.keyVersion??null,attempt:row.attempts}]})
}
export function webhookHealth(s:State){
 const subscriptions=rows(s,'webhookSubscription'),deliveries=rows(s,'webhookDelivery')
 return {subscriptions,deliveries,exceptions:deliveries.filter(d=>['failed','uncertain','blocked'].includes(d.status)),health:subscriptions.map(s=>({id:s.id,label:s.label,active:s.active,pending:deliveries.filter(d=>d.subscriptionId===s.id&&d.status==='pending').length,exceptions:deliveries.filter(d=>d.subscriptionId===s.id&&['failed','uncertain','blocked'].includes(d.status)).length}))}
}
