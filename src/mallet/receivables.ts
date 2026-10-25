import {creditAccount} from './credits'
import {invoiceBalance} from './payments'
import {event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State,type Row} from './model'
export const latestLedger=(s:State,kind:string,predicate:(row:Row)=>boolean)=>rows(s,kind).filter(predicate).sort((a,b)=>(a.stateVersion??0)-(b.stateVersion??0)||a.id.localeCompare(b.id)).at(-1)
export const receivableCommands=['ar.terms','ar.invoice','ar.dispute','ar.promise','ar.remind','ar.reminderClaim','ar.reminderOutcome']
export function utcDate(value:unknown){const v=text(value,'UTC date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail('INPUT','Use a valid UTC calendar date.',null,400);return v}
export function accountStatement(s:State,accountId:string,asOf:string){
 const account=find(s,'customerAccount',accountId);if(account.mergedInto)fail('AR_ACCOUNT','Review the surviving account explicitly.')
 const invoices=rows(s,'invoice').filter(i=>['approved','exported'].includes(i.status)&&creditAccount(s,i.billing?.accountId)===account.id).map(i=>{
  const terms=rows(s,'arInvoice').find(r=>r.invoiceId===i.id),balance=invoiceBalance(s,i),dispute=latestLedger(s,'arDispute',r=>r.invoiceId===i.id),promise=latestLedger(s,'arPromise',r=>r.invoiceId===i.id),job=find(s,'job',i.jobId)
  const overdueDays=terms?Math.max(0,Math.floor((Date.parse(asOf)-Date.parse(terms.dueOn))/86400000)):null
  const bucket=overdueDays===null?'No terms':overdueDays===0?'Current':overdueDays<=30?'1–30':overdueDays<=60?'31–60':overdueDays<=90?'61–90':'91+'
  return {invoiceId:i.id,number:i.number,jobId:i.jobId,assetId:job.assetId,vehicle:job.asset.label,terms,balance,dispute,promise,overdueDays,bucket,chaseEligible:!!terms&&overdueDays!==null&&balance.outstandingCents>0&&dispute?.status!=='open'&&(!promise||promise.promisedOn<asOf),recordedCostCents:i.totals.totalCents,downtime:{from:job.startAt,to:job.completedAt??null,label:'Booked start to recorded completion; actual off-road time is not verified.'}}
 })
 const ageing=Object.fromEntries(['Current','1–30','31–60','61–90','91+','No terms'].map(b=>[b,invoices.filter(i=>i.bucket===b).reduce((n,i)=>n+i.balance.outstandingCents,0)]))
 return {accountId:account.id,accountName:account.name,asOf,currency:'USD',invoices,ageing,outstandingCents:invoices.reduce((n,i)=>n+i.balance.outstandingCents,0),basis:'Current ledger balances aged at the selected UTC date; this is not a historical balance snapshot. Recorded checks reduce balances without claiming clearance. Promises due today suppress chasing through today. A statement read sends no reminder. An owner may explicitly send a consented balance reminder before or after its due date; no overdue claim is inferred.'}
}
export const receivables:Handler=(c,command,p)=>{
 if(!receivableCommands.includes(command)||command==='ar.remind')return
 if(command==='ar.reminderOutcome'){
  if(c.actor.role!=='system')fail('FORBIDDEN','Only the mail outcome recorder can finish a reminder.',null,403)
  const reminder=find(c.s,'arReminder',p.reminderId);expectVersion(reminder,p.version)
  if(reminder.status!=='unconfirmed')fail('AR_REMINDER','Retain the original outcome; never retry a claimed reminder.')
  if(!['accepted','development','failed','uncertain'].includes(p.status))fail('INPUT','Unknown mail outcome.',null,400)
  const result={...reminder,version:reminder.version+1,status:p.status,provider:text(p.provider,'mail provider'),providerMessageId:p.providerMessageId??null,outcomeAt:c.now}
  rows(c.s,'arReminder')[rows(c.s,'arReminder').findIndex(r=>r.id===reminder.id)]=result;event(c,command,reminder.jobId,reminder.id,{status:result.status});return result
 }
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages commercial terms, disputes and promises.',null,403)
 const evidence=text(p.evidence,'explicit account instruction and owner review evidence',2000)
 if(command==='ar.reminderClaim'){
  const invoice=find(c.s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
  const accountId=creditAccount(c.s,invoice.billing?.accountId);if(!accountId)fail('AR_ACCOUNT','Review an explicit commercial payer first.');const account=find(c.s,'customerAccount',accountId),terms=latestLedger(c.s,'arTerms',r=>r.accountId===accountId)
  if(!terms?.active||terms.by.id!==c.actor.id||terms.accountVersion!==account.version)fail('AR_TERMS','The current owner must review active terms for the unchanged account.')
  const item=accountStatement(c.s,accountId,c.now.slice(0,10)).invoices.find(i=>i.invoiceId===invoice.id)
  if(!item?.chaseEligible||!item.terms)fail('AR_SUPPRESSED','No reminder for a paid, disputed or promised balance, or an invoice without terms.')
  if(p.outstandingCents!==item.balance.outstandingCents)fail('AR_BALANCE','Review the current outstanding balance before sending.')
  const contact=find(c.s,'contact',account.billingContactId)
  if(!account.contactIds.includes(contact.id)||contact.communication!=='email'||!contact.email||p.to!==contact.email)fail('AR_RECIPIENT','Review the current billing contact email and its email preference.')
  if(p.consent!==true||p.confirm!=='send-balance-reminder')fail('AR_CONSENT','Explicitly confirm consent for this exact balance reminder.')
  const reference=text(p.reference,'unique reminder reference'),consentEvidence=text(p.consentEvidence,'explicit email consent evidence',2000)
  if(rows(c.s,'arReminder').some(r=>r.reference===reference))fail('AR_REMINDER','This reference has already been claimed; inspect its outcome, never resend automatically.')
  const content='Your repair shop requests payment of the recorded outstanding balance for invoice '+invoice.number+': USD '+(item.balance.outstandingCents/100).toFixed(2)+'. Balance due '+item.terms.dueOn+'. Please contact the shop about payment or a dispute. Recorded tender is not independent bank verification.'
  const row=put(c.s,'arReminder',{accountId,invoiceId:invoice.id,invoiceRevision:invoice.revision,jobId:invoice.jobId,assignmentId:item.terms.id,termsId:terms.id,contactId:contact.id,contactVersion:contact.version,to:contact.email,outstandingCents:item.balance.outstandingCents,dueOn:item.terms.dueOn,reference,consentEvidence,evidence,content,status:'unconfirmed',by:who(c),at:c.now})
  event(c,command,invoice.jobId,row.id,{});return row
 }
 if(command==='ar.terms'){
  const account=find(c.s,'customerAccount',p.accountId);expectVersion(account,p.version)
  if(account.mergedInto||!['business','fleet'].includes(account.kind))fail('AR_ACCOUNT','Approve terms only for an explicitly reviewed current commercial account.')
  if(typeof p.active!=='boolean')fail('INPUT','Declare whether these terms are active.',null,400)
  if(p.consent!==true)fail('AR_CONSENT','Record explicit account consent to these terms.')
  const row=put(c.s,'arTerms',{stateVersion:c.s.version,accountId:account.id,accountVersion:account.version,days:integer(p.days,'net days',1,365),limitCents:integer(p.limitCents,'credit limit USD cents',1),active:p.active===true,evidence,consent:true,by:who(c),at:c.now})
  event(c,command,null,row.id,{});return row
 }
 const invoice=find(c.s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
 if(!['approved','exported'].includes(invoice.status))fail('AR_INVOICE','Use an approved immutable invoice.')
 const accountId=creditAccount(c.s,invoice.billing?.accountId);if(!accountId)fail('AR_ACCOUNT','An explicit invoice payer account is required.')
 let value:any
 if(command==='ar.invoice'){
  if(rows(c.s,'arInvoice').some(r=>r.invoiceId===invoice.id))fail('AR_DUPLICATE','This invoice already retains its original terms approval.')
  const account=find(c.s,'customerAccount',accountId),terms=latestLedger(c.s,'arTerms',r=>r.accountId===account.id)
  if(!terms||!terms.active||terms.by.id!==c.actor.id||terms.id!==p.termsId||terms.accountVersion!==account.version)fail('AR_TERMS','Review the current active terms for this unchanged account.')
  const statement=accountStatement(c.s,account.id,c.now.slice(0,10))
  if(statement.outstandingCents>terms.limitCents)fail('AR_LIMIT','The current account balance exceeds its approved credit limit.')
  const dueOn=new Date(Date.parse(c.now.slice(0,10))+terms.days*86400000).toISOString().slice(0,10)
  const fleet=account.kind==='fleet'
  if(fleet&&(!account.authorizerId||p.authorizerId!==account.authorizerId||invoice.billing?.authorizer?.id!==account.authorizerId))fail('FLEET_AUTHORIZER','Record approval from the fleet’s current allowed authorizer; a driver alone cannot approve terms.')
  value={accountId:account.id,invoiceId:invoice.id,invoiceRevision:invoice.revision,invoiceTotalCents:invoice.totals.totalCents,terms:structuredClone(terms),reviewedOutstandingCents:statement.outstandingCents,dueOn,po:fleet?text(p.po,'fleet purchase order'):null,authorizerId:fleet?account.authorizerId:null,evidence,by:who(c),at:c.now,label:'Recorded commercial terms; no payment, handover authority or outbound message.'}
 }else if(command==='ar.dispute')value={accountId,invoiceId:invoice.id,status:p.status==='resolved'?'resolved':p.status==='open'?'open':fail('INPUT','Choose open or resolved.',null,400),evidence,by:who(c),at:c.now}
 else value={accountId,invoiceId:invoice.id,promisedOn:utcDate(p.promisedOn),amountCents:integer(p.amountCents,'promised USD cents',1),evidence,by:who(c),at:c.now}
 if(command==='ar.promise'&&(value.promisedOn<c.now.slice(0,10)||value.amountCents>invoiceBalance(c.s,invoice).outstandingCents))fail('AR_PROMISE','A promise must be current and within the outstanding balance.')
 const kind=command==='ar.invoice'?'arInvoice':command==='ar.dispute'?'arDispute':'arPromise',row=put(c.s,kind,{...value,stateVersion:c.s.version});event(c,command,invoice.jobId,row.id,{});return row
}

/** Open terms release is an explicit current-owner choice, never a payment observation. */
export function openTermsRelease(s:State,invoice:Row,ownerId:string,assignmentId:unknown){
 const assignment=rows(s,'arInvoice').find(r=>r.id===assignmentId&&r.invoiceId===invoice.id)
 if(!assignment||assignment.by.id!==ownerId||assignment.invoiceRevision!==invoice.revision||assignment.invoiceTotalCents!==invoice.totals.totalCents)fail('AR_RELEASE','Use this current owner’s reviewed terms assignment for the exact invoice.')
 const accountId=creditAccount(s,invoice.billing?.accountId),account=find(s,'customerAccount',accountId)
 const terms=latestLedger(s,'arTerms',r=>r.accountId===accountId)
 if(account.mergedInto||assignment.accountId!==account.id||!terms?.active||terms.by.id!==ownerId||terms.accountVersion!==account.version)fail('AR_RELEASE','The current owner must review active terms for this unchanged payer account.')
 const statement=accountStatement(s,account.id,assignment.at.slice(0,10))
 if(statement.outstandingCents>terms.limitCents)fail('AR_LIMIT','The current account balance exceeds its approved credit limit.')
 if(account.kind==='fleet'&&(assignment.authorizerId!==account.authorizerId||invoice.billing?.authorizer?.id!==account.authorizerId))fail('FLEET_AUTHORIZER','Review the current fleet authorizer before release on account.')
 return {assignment:structuredClone(assignment),currentApproval:structuredClone(terms),accountId:account.id,accountName:account.name,dueOn:assignment.dueOn,outstandingCents:invoiceBalance(s,invoice).outstandingCents,label:'Released on account terms; balance due '+assignment.dueOn}
}
