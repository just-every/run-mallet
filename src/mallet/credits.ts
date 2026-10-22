import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State,type Row} from './model'
import {quantity,totals} from './money'
import {invoiceBalance} from './payments'
export const creditCommands=['credit.preview','credit.issue','credit.apply','credit.exchange','refund.record','refund.redirect','refund.claim','refund.outcome'] as const
export const internalRefundCommands=['refund.claim','refund.outcome']
export function creditAccount(s:State,id:string|undefined):string|null{
 if(!id)return null
 const seen=new Set<string>()
 while(id){if(seen.has(id))fail('CREDIT_ACCOUNT','The account merge chain is invalid.');seen.add(id);const account=find(s,'customerAccount',id);if(!account.mergedInto)return account.id;id=account.mergedInto}
 return null
}
const originalLine=(a:any,b:any)=>a.lineId===b.lineId&&a.sourceEstimateId===b.sourceEstimateId&&a.sourceRevision===b.sourceRevision
const portion=(cents:number,n:number,d:number)=>Number((BigInt(cents)*BigInt(n)*2n+BigInt(d))/(2n*BigInt(d)))
function request(s:State,p:any){
 const invoice=find(s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
 if(!['approved','exported'].includes(invoice.status))fail('CREDIT_INVOICE','Credit only an approved immutable invoice.')
 if(!Array.isArray(p.lines)||!p.lines.length||p.lines.length>100)fail('INPUT','Choose 1–100 original invoice lines.',null,400)
 const lines=p.lines.map((value:any)=>({lineId:text(value.lineId,'invoice line'),sourceEstimateId:text(value.sourceEstimateId,'source estimate'),sourceRevision:integer(value.sourceRevision,'source revision',1),quantityMilli:quantity(value.quantity)}))
 if(new Set(lines.map((l:any)=>JSON.stringify([l.lineId,l.sourceEstimateId,l.sourceRevision]))).size!==lines.length)fail('INPUT','Select each original invoice line once.',null,400)
 return {invoiceId:invoice.id,invoiceVersion:invoice.version,lines,destination:choice(p.destination,['original-tender','account-credit'],'credit destination'),paymentId:p.destination==='original-tender'?text(p.paymentId,'original payment'):null,reference:text(p.reference,'unique credit reference'),reason:text(p.reason,'return or credit reason',2000),consentEvidence:text(p.consentEvidence,'customer refund or account-credit instruction',2000)}
}
function preview(s:State,r:ReturnType<typeof request>){
 const invoice=find(s,'invoice',r.invoiceId),notes=rows(s,'creditNote').filter(n=>n.invoiceId===invoice.id)
 const lines=r.lines.map((selected:any)=>{
  const source=invoice.lines.find((l:any)=>originalLine(selected,{lineId:l.id,sourceEstimateId:l.sourceEstimateId,sourceRevision:l.sourceRevision}))
  if(!source)fail('CREDIT_LINE','Choose a line from this exact invoice.')
  const prior=notes.flatMap(n=>n.lines).filter((l:any)=>originalLine(l,selected)).reduce((n:number,l:any)=>n+l.quantityMilli,0),next=prior+selected.quantityMilli
  if(next>source.quantityMilli)fail('CREDIT_QUANTITY','This return exceeds the uncredited original quantity.')
  const subtotalCents=portion(source.subtotalCents,next,source.quantityMilli)-portion(source.subtotalCents,prior,source.quantityMilli),salesTaxCents=portion(source.salesTaxCents,next,source.quantityMilli)-portion(source.salesTaxCents,prior,source.quantityMilli)
  return {...selected,description:source.description,kind:source.kind,quantity:selected.quantityMilli/1000,subtotalCents,salesTaxCents,totalCents:subtotalCents+salesTaxCents,taxRateMillionths:source.taxRateMillionths,taxable:source.taxable}
 }),amount=totals(lines),accountId=creditAccount(s,invoice.billing?.accountId)
 if(amount.totalCents<=0)fail('CREDIT_AMOUNT','The selected quantity must credit at least one cent.')
 const paid=rows(s,'payment').filter(p=>p.invoiceId===invoice.id).reduce((n,p)=>n+p.amountCents,0),reserved=notes.reduce((n,r)=>n+r.totals.totalCents,0)
 if(amount.totalCents>paid-reserved)fail('CREDIT_AMOUNT','Do not refund or create spendable credit beyond recorded uncredited tender.')
 let method='account-credit'
 if(r.destination==='original-tender'){
  const payment=find(s,'payment',r.paymentId)
  if(payment.invoiceId!==invoice.id)fail('CREDIT_PAYMENT','Refund only tender allocated to this invoice.')
  if(!['cash','check','other','stripe'].includes(payment.method))fail('CREDIT_PAYMENT','Return a customer-credit allocation to account credit, never to cash or another tender.')
  const reserved=rows(s,'refund').filter(x=>x.paymentId===payment.id).reduce((n,x)=>n+x.amountCents,0)
  if(amount.totalCents>payment.amountCents-reserved)fail('CREDIT_AMOUNT','The original tender has insufficient unreserved refundable balance.')
  method=payment.method
 }else{
  if(!accountId)fail('CREDIT_ACCOUNT','Account credit requires the invoice’s recorded customer account; do not infer identity from a name or email.')
 }
 return {stateVersion:s.version,invoiceId:invoice.id,invoiceVersion:invoice.version,invoiceNumber:invoice.number,accountId,lines,totals:amount,destination:r.destination,paymentId:r.paymentId,method}
}
export const credits:Handler=(c,command,p)=>{
 if(!(creditCommands as readonly string[]).includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner approves refunds, credits and exchanges until delegated financial authority is implemented.',null,403)
 if(command==='credit.preview'||command==='credit.issue'){
  const r=request(c.s,p),prior=rows(c.s,'creditNote').find(n=>n.reference===r.reference)
  if(prior){if(JSON.stringify(prior.request)!==JSON.stringify(r))fail('CREDIT_REPLAY','This credit reference already records different instructions.');return prior}
  const review=preview(c.s,r)
  if(command==='credit.preview')return review
  if(p.confirm!=='issue-credit'||JSON.stringify(p.review)!==JSON.stringify(review))fail('CREDIT_REVIEW','Review the exact current credit and confirm issue; a changed balance or source needs a new preview.')
  const invoice=find(c.s,'invoice',r.invoiceId),note=put(c.s,'creditNote',{...review,number:'MC-'+String(rows(c.s,'creditNote').length+1).padStart(6,'0'),jobId:invoice.jobId,reference:r.reference,request:r,reason:r.reason,consentEvidence:r.consentEvidence,by:who(c),at:c.now,label:'Issued credit note. Original invoice and tax snapshots remain unchanged; no stock movement is implied.'})
  if(r.destination==='original-tender')put(c.s,'refund',{jobId:invoice.jobId,invoiceId:invoice.id,creditNoteId:note.id,paymentId:r.paymentId,method:review.method,amountCents:review.totals.totalCents,status:'unsubmitted',providerId:null,history:[],by:who(c),at:c.now})
  event(c,command,invoice.jobId,note.id,{number:note.number,totalCents:note.totals.totalCents});return note
 }
 if(command==='credit.apply'||command==='credit.exchange'){
  const note=find(c.s,'creditNote',p.creditNoteId),invoice=find(c.s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
  const amountCents=integer(p.amountCents,'credit allocation cents',1),reference=text(p.reference,'unique allocation reference'),reason=text(p.reason,'allocation or exchange reason',2000)
  if(p.confirm!=='apply-credit')fail('CREDIT_REVIEW','Confirm this exact credit allocation.')
  const redirected=rows(c.s,'refund').find(r=>r.creditNoteId===note.id)?.redirect
  if(!(note.destination==='account-credit'||redirected?.destination==='account-credit')||!['approved','exported'].includes(invoice.status)||creditAccount(c.s,note.accountId)!==creditAccount(c.s,invoice.billing?.accountId))fail('CREDIT_ACCOUNT','Apply issued account credit only to an approved invoice belonging to the same current account.')
  if(command==='credit.exchange'&&(!note.lines.some((l:any)=>l.kind==='part')||!invoice.lines.some((l:any)=>l.kind==='part')))fail('CREDIT_EXCHANGE','An accessory exchange needs a returned part and a separately authorized replacement part invoice.')
  const prior=rows(c.s,'payment').find(x=>x.reference===reference)
  if(prior){if(prior.creditNoteId===note.id&&prior.invoiceId===invoice.id&&prior.amountCents===amountCents&&prior.reason===reason&&prior.exchange===(command==='credit.exchange'))return prior;fail('CREDIT_REPLAY','This allocation reference already has different instructions.')}
  const used=rows(c.s,'payment').filter(x=>x.creditNoteId===note.id).reduce((n,x)=>n+x.amountCents,0)
  if(amountCents>note.totals.totalCents-used||amountCents>invoiceBalance(c.s,invoice).outstandingCents)fail('CREDIT_AMOUNT','The allocation exceeds the unspent credit or destination invoice balance.')
  const payment=put(c.s,'payment',{jobId:invoice.jobId,invoiceId:invoice.id,invoiceNumber:invoice.number,creditNoteId:note.id,amountCents,reference,reason,exchange:command==='credit.exchange',method:'customer-credit',verified:false,label:'Customer credit allocation; no new cash or processor settlement.',by:who(c),at:c.now})
  event(c,command,invoice.jobId,payment.id,{creditNoteId:note.id,amountCents});return payment
 }
 const refund=find(c.s,'refund',p.refundId)
 if(command==='refund.redirect'){
  const destination=choice(p.destination,['account-credit','manual-tender'],'refund redirect destination'),reference=text(p.reference,'unique refund redirect reference'),consentEvidence=text(p.consentEvidence,'new customer refund redirect instruction',2000)
  const accountId=destination==='account-credit'?text(p.accountId,'current customer account'):null,method=destination==='manual-tender'?choice(p.method,['cash','check','other'],'manual refund tender'):'account-credit'
  const request={destination,accountId,method,reference,consentEvidence}
  if(p.confirm!=='redirect-refund')fail('REFUND_REVIEW','Explicitly confirm the failed refund redirect.')
  const prior=rows(c.s,'refund').find(r=>r.redirect?.reference===reference)
  if(prior){if(prior.id===refund.id&&JSON.stringify(prior.redirect.request)===JSON.stringify(request))return prior;fail('REFUND_REPLAY','This redirect reference already records different instructions.')}
  expectVersion(refund,p.version)
  if(refund.method!=='stripe'||refund.status!=='failed'||refund.redirect)fail('REFUND_STATE','Redirect only a processor-confirmed failed Stripe refund once; pending and uncertain refunds stay reserved.')
  if(rows(c.s,'refund').some(r=>r.history.some((h:any)=>h.reference===reference)))fail('REFUND_REPLAY','This reference already records another refund outcome.')
  const note=find(c.s,'creditNote',refund.creditNoteId),currentAccount=creditAccount(c.s,note.accountId)
  if(destination==='account-credit'&&(!currentAccount||accountId!==currentAccount))fail('CREDIT_ACCOUNT','Redirect credit only to the invoice’s same current account.')
  const redirect={...request,request,status:destination==='account-credit'?'credited':'unsubmitted',by:who(c),at:c.now,label:'Owner-recorded failed-refund redirect; no money moved or verified by Mallet.'}
  const next=bump(c.s,'refund',refund,{status:'redirected',redirect,history:[...refund.history,{status:'redirected',reference,by:who(c),at:c.now}]})
  event(c,command,refund.jobId,refund.id,{destination,method,amountCents:refund.amountCents});return next
 }
 if(command==='refund.record'){
  if(refund.method==='stripe'&&refund.redirect?.destination!=='manual-tender')fail('REFUND_PROVIDER','Stripe outcomes must come from the processor, never a staff flag.')
  const status=choice(p.status,['refunded','failed','disputed'],'observed manual refund outcome'),reference=text(p.reference,'unique refund observation reference'),evidence=text(p.evidence,'manual original-tender outcome evidence',2000)
  if(p.confirm!=='record-refund')fail('REFUND_REVIEW','Explicitly confirm the observed original-tender refund outcome.')
  const prior=rows(c.s,'refund').flatMap(x=>x.history.map((entry:any)=>({...entry,refundId:x.id}))).find((x:any)=>x.reference===reference)
  if(prior){if(prior.refundId===refund.id&&prior.status===status&&prior.evidence===evidence)return refund;fail('REFUND_REPLAY','This refund observation reference already has different facts.')}
  expectVersion(refund,p.version)
  if((refund.redirect?.status??refund.status)==='refunded')fail('REFUND_FINAL','Keep the original completed refund unchanged; never pay it twice.')
  if(rows(c.s,'refund').some(r=>r.redirect?.reference===reference))fail('REFUND_REPLAY','This reference already records a redirect.')
  const outcome={status,reference,evidence,by:who(c),at:c.now,label:'Owner-recorded manual refund; Mallet did not move or verify money.'},next=bump(c.s,'refund',refund,{...(refund.redirect?{redirect:{...refund.redirect,status}}:{status}),history:[...refund.history,outcome]})
  event(c,command,refund.jobId,refund.id,{status,amountCents:refund.amountCents});return next
 }
 expectVersion(refund,p.version)
 if(refund.redirect)fail('REFUND_FINAL','A redirected refund cannot receive another processor outcome.')
 if(refund.method!=='stripe')fail('REFUND_PROVIDER','Only a Stripe tender can use the connected processor.')
 if(command==='refund.claim'){
  if(p.confirm!=='send-refund'||refund.status!=='unsubmitted')fail('REFUND_STATE','Confirm a new refund once; pending or uncertain submissions must be reconciled, never resent.')
  const next=bump(c.s,'refund',refund,{status:'pending',history:[...refund.history,{status:'pending',by:who(c),at:c.now,label:'Owner approved one original-tender Stripe refund submission.'}]});event(c,command,refund.jobId,refund.id,{});return next
 }
 if(refund.status==='unsubmitted')fail('REFUND_STATE','A processor outcome requires a prior approved submission.')
 const status=choice(p.status,['pending','uncertain','failed','refunded'],'processor outcome'),receipt=p.receipt??null
 if(refund.status==='refunded'){if(status==='refunded'&&receipt?.id===refund.providerId)return refund;fail('REFUND_FINAL','A completed processor refund cannot be overwritten by a stale event.')}
 if(refund.status===status&&JSON.stringify(refund.history.at(-1)?.receipt)===JSON.stringify(receipt))return refund
 const outcome={status,receipt,by:who(c),at:c.now},next=bump(c.s,'refund',refund,{status,providerId:receipt?.id??refund.providerId,history:[...refund.history,outcome]})
 event(c,command,refund.jobId,refund.id,{status,amountCents:refund.amountCents});return next
}
