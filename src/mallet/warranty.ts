import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler} from './model'
import {instant,workshop} from './workshop'
import {invoiceBalance,publicInvoiceSnapshot} from './payments'
export const warrantyCommands=['warranty.terms','warranty.open','warranty.decide','warranty.cost','warranty.claim','warranty.claimOutcome'] as const
export const warranty:Handler=(c,command,p)=>{
 if(!(warrantyCommands as readonly string[]).includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only an owner or service advisor manages warranty work.',null,403)
 if(command==='warranty.terms'){
  const invoice=find(c.s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
  if(!['approved','exported'].includes(invoice.status))fail('WARRANTY_INVOICE','Approve the original invoice first.')
  const startsAt=instant(p.startsAt,'coverage starts'),endsAt=instant(p.endsAt,'coverage ends')
  if(endsAt<startsAt)fail('INPUT','Coverage ends no earlier than it starts.',null,400)
  const current=rows(c.s,'warrantyTerms').filter(t=>t.invoiceId===invoice.id)
  const row=put(c.s,'warrantyTerms',{jobId:invoice.jobId,invoiceId:invoice.id,n:current.length+1,startsAt,endsAt,mileageLimit:integer(p.mileageLimit,'absolute mileage coverage limit'),unit:choice(p.unit,['mi','km','hours'],'coverage reading unit'),terms:text(p.terms,'warranty terms',4000),by:who(c),at:c.now});event(c,command,invoice.jobId,row.id,{n:row.n});return row
 }
 if(command==='warranty.open'){
  const terms=find(c.s,'warrantyTerms',p.termsId),invoice=find(c.s,'invoice',terms.invoiceId),original=find(c.s,'job',invoice.jobId)
  if(invoiceBalance(c.s,invoice).outstandingCents)fail('WARRANTY_UNPAID','Record the original paid invoice’s tender evidence before linking a comeback.')
  const uses=rows(c.s,'stockUse').filter(u=>u.jobId===original.id),installed=p.stockUseId?find(c.s,'stockUse',p.stockUseId):null
  if(installed&&installed.jobId!==original.id||uses.length&&!installed)fail('WARRANTY_PART','Identify an installed part/lot from the original repair.')
  const failureAt=instant(p.failureAt,'failure time'),mileage=integer(p.mileage,'failure mileage or hours')
  if(failureAt>c.now)fail('INPUT','Failure time cannot be in the future.',null,400)
  const asset=find(c.s,'asset',original.assetId)
  if(p.assetId!==asset.id)fail('WARRANTY_ASSET','A comeback must use the original vehicle or serial.')
  const plan={assetId:asset.id,version:p.assetVersion,title:text(p.title,'rework title'),bayId:p.bayId,technicianId:p.technicianId,startAt:p.startAt,endAt:p.endAt}
  const rework=workshop(c,'job.book',plan)
  const row=put(c.s,'warranty',{jobId:rework.id,originalJobId:original.id,assetId:asset.id,identifier:invoice.customer.identifier,invoiceId:invoice.id,originalInvoice:publicInvoiceSnapshot(invoice),originalPayment:structuredClone(invoiceBalance(c.s,invoice)),terms:structuredClone(terms),installed:installed?structuredClone(installed):null,lot:installed?structuredClone(find(c.s,'stockLot',installed.lotId)):null,failure:text(p.failure,'returned symptom and failure evidence',4000),failureAt,mileage,unit:terms.unit,withinTerms:failureAt>=terms.startsAt&&failureAt<=terms.endsAt&&mileage<=terms.mileageLimit,decision:null,costs:[],claims:[],by:who(c),at:c.now})
  event(c,command,rework.id,row.id,{originalJobId:original.id,invoiceId:invoice.id});return row
 }
 const row=find(c.s,'warranty',p.warrantyId);expectVersion(row,p.version)
 const save=(changes:any,data:any)=>{const next=bump(c.s,'warranty',row,changes);event(c,command,row.jobId,row.id,data);return next}
 if(command==='warranty.decide'){
  if(row.decision)fail('WARRANTY_DECIDED','This coverage decision is immutable; retain it and open another case for new evidence.')
  const outcome=choice(p.outcome,['covered','declined'],'coverage decision'),responsibility=choice(p.responsibility,['shop','supplier','OEM'],'responsibility'),reason=text(p.reason,'coverage decision evidence',2000)
  if(outcome==='covered'&&!row.withinTerms)fail('WARRANTY_COVERAGE','This failure is outside the saved time or mileage terms; do not infer coverage.')
  const decision={outcome,responsibility,reason,noChargeLabor:outcome==='covered',by:who(c),at:c.now}
  return save({decision},decision)
 }
 if(row.decision?.outcome!=='covered')fail('WARRANTY_COVERAGE','Approve explicit coverage before no-charge cost or claim tracking.')
 if(command==='warranty.cost'){
  const job=find(c.s,'job',row.jobId),actual=job.actuals.find((x:any)=>x.id===p.actualId)
  if(!actual)fail('WARRANTY_WORK','Choose recorded authorized actual work from this rework repair.')
  const invoiceSource=find(c.s,'estimate',actual.estimateId),line=invoiceSource.revisions.find((r:any)=>r.n===actual.revision)?.lines.find((l:any)=>l.id===actual.lineId)
  if(!line||line.unitCents-(line.unitDiscountCents??0)!==0)fail('WARRANTY_CHARGE','Covered rework costs require separately customer-authorized no-charge work; never change the original invoice.')
  if(row.costs.some((x:any)=>x.actualId===actual.id))fail('WARRANTY_COST','Cost is already recorded for this actual.')
  const cost={id:crypto.randomUUID(),actualId:actual.id,actual:structuredClone(actual),kind:line.kind,amountCents:integer(p.amountCents,'actual rework cost in USD cents'),evidence:text(p.evidence,'cost evidence',2000),by:who(c),at:c.now}
  return save({costs:[...row.costs,cost]},cost)
 }
 if(command==='warranty.claim'){
  const reference=text(p.reference,'unique claim reference',200),claimant=text(p.claimant,'supplier or OEM',200),amountCents=integer(p.amountCents,'claim amount in USD cents',1),costCents=row.costs.reduce((n:number,x:any)=>n+x.amountCents,0)
  if(row.decision.responsibility==='shop'||amountCents>costCents-row.claims.reduce((n:number,x:any)=>n+x.amountCents,0))fail('WARRANTY_CLAIM','Supplier/OEM claims must fit recorded uncovered rework costs and approved responsibility.')
  if(rows(c.s,'warranty').some(w=>w.claims.some((x:any)=>x.reference===reference&&x.claimant===claimant)))fail('WARRANTY_CLAIM','That supplier claim reference already exists.')
  const claim={id:crypto.randomUUID(),reference,claimant,amountCents,evidence:text(p.evidence,'claim evidence',2000),status:'prepared',history:[],by:who(c),at:c.now,label:'Approved claim record only; not submitted by Mallet.'}
  return save({claims:[...row.claims,claim]},claim)
 }
 const claim=row.claims.find((x:any)=>x.id===p.claimId)
 if(!claim)fail('NOT_FOUND','That claim does not belong to this warranty.',null,404)
 const status=choice(p.status,['submitted','accepted','rejected','credited'],'claim outcome'),previous=claim.history.at(-1)?.status??'prepared'
 if(!({prepared:['submitted'],submitted:['accepted','rejected'],accepted:['credited'],rejected:[],credited:[]} as Record<string,string[]>)[previous].includes(status))fail('WARRANTY_CLAIM_STATE','Retain the ordered claim outcome history; no automatic submission or credit is inferred.')
 const outcome={status,evidence:text(p.evidence,'external claim outcome evidence',2000),creditCents:status==='credited'?integer(p.creditCents,'supplier credit in USD cents',1,claim.amountCents):0,by:who(c),at:c.now}
 return save({claims:row.claims.map((x:any)=>x.id===claim.id?{...x,status,history:[...x.history,outcome]}:x)},outcome)
}
