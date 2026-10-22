import {createHash} from 'node:crypto'
import {bump,choice,event,expectVersion,fail,find,integer,object,put,text,who,type Context,type Handler,type Row} from './model'
import {current,estimates} from './estimates'
import {lines,totals} from './money'
import {configuredTax} from './tax'
import {workshop} from './workshop'
import {intakeDisclosures} from './intake-form-copy'

export const checkInCommands=['checkin.issue','checkin.submit','checkin.confirm','checkin.revoke'] as const
export const internalCheckInCommands=['checkin.submit']
export const CHECKIN_DIAGNOSTIC_CONSENT='I authorize only the exact diagnostic assessment and total shown here, subject to the advisor confirming this booking and diagnostic spend. Requested repairs, teardown and payment charges require separate authorization.'
export const CHECKIN_ELECTRONIC_CONSENT='I agree to sign this check-in electronically and receive its printable queue receipt through this private link. This consent covers this check-in only.'
const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
function taxSnapshot(c:Context){
 const {currency,ratePercent,rateMillionths,partsTaxable,laborTaxable}=configuredTax(c.s)
 return {currency,ratePercent,rateMillionths,partsTaxable,laborTaxable}
}
function diagnosticLine(row:Row){
 const line=row.quote.lines[0]
 return {id:line.id,kind:'labor',description:line.description,quantity:1,unitCents:line.unitCents}
}
function submission(row:Row,p:any){
 const email=text(p.email,'customer email',254)
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('INPUT','Provide a valid customer email.',null,400)
 const requestedWork=text(p.requestedWork,'requested work',4000),rawAnswers=p.answers===undefined?{}:object(p.answers,'custom answers')
 const answers={symptom:requestedWork,...Object.fromEntries((row.template.fields??[]).map((f:any)=>[f.key,text(rawAnswers[f.key],f.label,2000,true)]))}
 const missingFields=(row.template.fields??[]).filter((f:any)=>f.required&&!answers[f.key as keyof typeof answers]).map((f:any)=>f.key)
 if(missingFields.length)fail('CHECKIN_FIELDS','Complete each required check-in field.',{missing:missingFields},422)
 const acknowledgments=Object.fromEntries((row.template.acknowledgments??[]).map((a:any)=>[a.key,p.acknowledgments?.[a.key]===true]))
 const missing=(row.template.acknowledgments??[]).filter((a:any)=>!acknowledgments[a.key]).map((a:any)=>a.key)
 if(missing.length)fail('CHECKIN_ACKNOWLEDGMENTS','Acknowledge each separately listed term before submitting.',{missing},422)
 if(p.diagnosticConsent!==true||p.electronicConsent!==true)fail('CHECKIN_CONSENT','Consent to the exact diagnostic total and electronic signing and receipt before submitting.',null,422)
 const diagnosticTotalCents=integer(p.diagnosticTotalCents,'diagnostic total in USD cents')
 if(diagnosticTotalCents!==row.quote.totals.totalCents)fail('CHECKIN_PRICE','Consent must name the exact issued diagnostic total.')
 return {contactName:text(p.contactName,'contact name'),email,phone:text(p.phone,'contact phone',100),vehicleIdentifier:text(p.vehicleIdentifier,'vehicle identifier',100),requestedWork,channel:choice(p.channel,['walk-in','drop-box','mobile'],'check-in channel'),keyDrop:text(p.keyDrop,'non-secret key drop notes',1000,true),typedName:text(p.typedName,'typed signature'),diagnosticConsent:true,electronicConsent:true,diagnosticTotalCents,answers,acknowledgments}
}
/** Apply native booking and estimate handlers in a single staged transaction. */
function confirm(c:Context,row:Row,p:any){
 expectVersion(row,p.version)
 if(row.revoked)fail('CHECKIN_REVOKED','A revoked check-in cannot be confirmed.')
 if(row.status!=='queued'||!row.receipt)fail('CHECKIN_STATE','Review a submitted check-in before confirming it.')
 if(p.confirmBooking!==true||p.confirmDiagnosticSpend!==true)fail('CHECKIN_CONFIRM','Explicitly confirm both booking and diagnostic spend.')
 if(integer(p.reviewedDiagnosticTotalCents,'reviewed diagnostic total')!==row.quote.totals.totalCents)fail('CHECKIN_PRICE','Review the exact customer-consented diagnostic total.')
 const asset=find(c.s,'asset',p.assetId);expectVersion(asset,p.assetVersion)
 if(asset.identifier.trim().toLowerCase()!==row.submission.vehicleIdentifier.toLowerCase())fail('CHECKIN_VEHICLE','Match the submitted vehicle identifier to the existing vehicle before confirming.')
 const review={assetId:asset.id,assetVersion:asset.version,contactEvidence:text(p.contactEvidence,'contact verification evidence',2000),vehicleEvidence:text(p.vehicleEvidence,'vehicle verification evidence',2000),keyReceipt:text(p.keyReceipt,'physical key receipt',2000),confirmBooking:true,confirmDiagnosticSpend:true,reviewedDiagnosticTotalCents:p.reviewedDiagnosticTotalCents}
 const tax=taxSnapshot(c),repriced=lines([diagnosticLine(row)],tax)
 if(JSON.stringify(tax)!==JSON.stringify(row.quote.tax)||JSON.stringify(totals(repriced))!==JSON.stringify(row.quote.totals))fail('CHECKIN_PRICE_CHANGED','The shop tax or diagnostic total changed. Issue a new invitation and obtain new customer consent.')
 const staged:Context={...c,s:structuredClone(c.s)}
 const booked=workshop(staged,'job.book',{assetId:asset.id,version:asset.version,title:'Diagnostic assessment',notes:'Check-in '+row.id+'. Requested work is retained in the queue receipt and remains unapproved.',...Object.fromEntries(['bayId','technicianId','startAt','endAt'].map(key=>[key,p[key]]))})
 let estimate=estimates(staged,'estimate.prepare',{jobId:booked.id,version:booked.version,lines:[diagnosticLine(row)],notes:'Diagnostic assessment only. No repair or teardown scope. Customer queue receipt SHA-256: '+row.receipt.sha256})
 if(JSON.stringify(current(estimate).lines)!==JSON.stringify(row.quote.lines)||JSON.stringify(current(estimate).totals)!==JSON.stringify(row.quote.totals))fail('CHECKIN_PRICE_CHANGED','The diagnostic estimate no longer matches the signed quote. Obtain new consent.')
 estimate=estimates(staged,'estimate.approve',{estimateId:estimate.id,version:estimate.version,revision:1})
 estimate=estimates(staged,'estimate.markSent',{estimateId:estimate.id,version:estimate.version,revision:1,method:'manual share',note:'Exact diagnostic quote was shown on the signed check-in; receipt '+row.receipt.sha256+'. No outbound message was sent.'})
 estimate=estimates(staged,'estimate.authorise',{estimateId:estimate.id,version:estimate.version,revision:1,lineIds:[row.quote.lines[0].id],customerName:row.submission.typedName,method:'signed',evidence:'Customer diagnostic-only consent on check-in '+row.id+' at '+row.receipt.signature.at+'; receipt SHA-256 '+row.receipt.sha256+'. Advisor verified contact and vehicle and explicitly confirmed the booking and exact diagnostic spend.'})
 const record={requestId:row.id,jobId:booked.id,estimateId:estimate.id,estimateRevision:1,diagnosticLineId:row.quote.lines[0].id,customerReceiptSha256:row.receipt.sha256,...review,review,quote:structuredClone(row.quote),by:who(c),at:c.now}
 const saved=bump(staged.s,'counterIntake',find(staged.s,'counterIntake',row.id),{status:'confirmed',jobId:booked.id,confirmation:{...record,sha256:hash(record)}})
 event(staged,'checkin.confirm',booked.id,row.id,{receiptSha256:row.receipt.sha256,confirmationSha256:saved.confirmation.sha256,estimateId:estimate.id})
 c.s.records=staged.s.records
 return saved
}
export const checkIns:Handler=(c,command,p)=>{
 if(!(checkInCommands as readonly string[]).includes(command))return
 if(command!=='checkin.submit'&&!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or service advisor may issue, confirm or revoke check-ins.',null,403)
 if(command==='checkin.issue'){
  const template=find(c.s,'intakeTemplate',p.templateId);expectVersion(template,p.templateVersion)
  const snapshot=structuredClone(template.revisions.at(-1)),tax=taxSnapshot(c)
  const priced=lines([{kind:'labor',description:'Diagnostic assessment only; no repair or teardown',quantity:1,unitCents:snapshot.diagnosticFeeCents}],tax)
  const disclosures={...intakeDisclosures(''),scope:'Electronic consent applies to this check-in and its queue receipt only. Diagnostic assessment requires advisor confirmation. Repairs, teardown and payments need separate authorization.',email:'Check your contact email before submitting. To change it after submitting, contact the shop; the shop must revoke this invitation and issue a replacement. The printable receipt is available immediately through this private link; no email is sent automatically.',access:'You can save or print your signed queue receipt through this private link. Link possession and a typed name do not verify identity; the advisor verifies contact and vehicle before confirming.'}
  const row=put(c.s,'counterIntake',{templateId:template.id,templateVersion:template.version,template:snapshot,quote:{lines:priced,totals:totals(priced),tax},electronicDisclosures:disclosures,status:'invited',submission:null,receipt:null,confirmation:null,jobId:null,expiresAt:new Date(Date.parse(c.now)+7*86400000).toISOString(),revoked:null,by:who(c),at:c.now})
  event(c,command,null,row.id,{templateId:template.id,templateRevision:snapshot.n});return row
 }
 const row=find(c.s,'counterIntake',p.requestId)
 if(command==='checkin.revoke'){
  expectVersion(row,p.version)
  if(row.revoked)fail('CHECKIN_REVOKED','This invitation is already revoked.')
  const saved=bump(c.s,'counterIntake',row,{revoked:{reason:text(p.reason,'revocation reason',2000),by:who(c),at:c.now}})
  event(c,command,row.jobId,row.id,{});return saved
 }
 if(command==='checkin.confirm')return confirm(c,row,p)
 if(c.actor.role!=='customer'||c.actor.id!=='check-in:'+row.id)fail('FORBIDDEN','Use this check-in’s own private customer invitation.',null,403)
 if(row.revoked||row.expiresAt<=c.now)fail('NOT_FOUND','This check-in invitation is unavailable.',null,404)
 object(p,'check-in submission')
 const entered=submission(row,p)
 if(row.submission){
  if(JSON.stringify(entered)!==JSON.stringify(row.submission))fail('CHECKIN_REPLAY','This check-in was already submitted. Contact the shop to correct it.')
  return row
 }
 const {by:_staff,...template}=row.template
 const base={requestId:row.id,queueReference:row.id,label:'Queue receipt: pending advisor contact and vehicle verification, booking and diagnostic spend confirmation. No repairs or payment charges are authorized.',template,quote:structuredClone(row.quote),submission:entered,electronicDisclosures:structuredClone(row.electronicDisclosures),signature:{typedName:entered.typedName,diagnosticConsent:CHECKIN_DIAGNOSTIC_CONSENT,electronicConsent:CHECKIN_ELECTRONIC_CONSENT,identityVerified:false,at:c.now},at:c.now}
 const saved=bump(c.s,'counterIntake',row,{status:'queued',submission:entered,receipt:{...base,sha256:hash(base)}})
 event(c,command,null,row.id,{status:'queued',receiptSha256:saved.receipt.sha256});return saved
}
