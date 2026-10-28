import {bump,choice,event,expectVersion,fail,find,put,rows,text,who,type Context,type State} from './model'
import {stockBalance} from './inventory'
import {conflicts,instant} from './workshop'
import {optedOut} from './approval-chasing'

export const DECLINED_POLICY='declined-email-v1'
export const DECLINED_WORDING_VERSION='declined-permission-v1'
export const declinedWording=(item:any)=>`Please send me one email about the declined work “${item.line.description}” identified by ${item.id}. This permission is for that item only, not appointment messages or other marketing. I may withdraw it before sending.`
export const declinedRecipient=(asset:any)=>String(asset.customerEmail??'').trim().toLowerCase()
export const declinedCustomer=(asset:any,s:State)=>({assetId:asset.id,assetVersion:asset.version,accountId:asset.customerAccountId??null,accountVersion:rows(s,'customerAccount').find(a=>a.id===asset.customerAccountId)?.version??null,contactVersions:rows(s,'contact').filter(r=>rows(s,'customerAccount').some(a=>a.id===asset.customerAccountId&&a.contactIds?.includes(r.id))).map(r=>({id:r.id,version:r.version})).sort((a,b)=>a.id.localeCompare(b.id)),name:asset.customerName,to:declinedRecipient(asset)})
export function declinedSuppressed(s:State,asset:any){
 return !!asset.privacyErasedAt||!!rows(s,'customerAccount').find(a=>a.id===asset.customerAccountId)?.privacyErasedAt||!!optedOut(s,declinedRecipient(asset))||rows(s,'declinedConsent').some(r=>(r.assetId===asset.id||r.to===declinedRecipient(asset))&&(r.withdrawnAt||r.erasureSuppressedAt))
}
export function currentDeclinedConsent(s:State,consent:any,item:any){
 const asset=find(s,'asset',item.assetId)
 if(!consent||consent.subjectId!==item.id||consent.purpose!=='declined-work'||consent.channel!=='email'||consent.withdrawnAt||declinedSuppressed(s,asset)||JSON.stringify(consent.customer)!==JSON.stringify(declinedCustomer(asset,s)))fail('OUTREACH_CONSENT','Current separate permission for this declined item and recipient is required.')
 return asset
}
/** Evidence is limited to native stock and this quote's booked repair. It reserves nothing. */
export function nativeDeclinedAvailability(s:State,item:any,q:any,mappings:any,now:string){
 const job=find(s,'job',q.jobId),asset=find(s,'asset',item.assetId)
 if(job.assetId!==item.assetId||job.status!=='booked'||job.actuals.length||job.startAt<=now||asset.privacyErasedAt)fail('OUTREACH_AVAILABILITY','A future native booked repair for this vehicle is required.')
 const bay=find(s,'calendarResource',job.bayId),tech=rows(s,'calendarTechnician').find(t=>t.technicianId===job.technicianId)
 if(!bay.active||bay.kind!=='bay'||!tech?.active||conflicts(s,job as any,job.id).length)fail('OUTREACH_AVAILABILITY','Native repair capacity is unavailable or unknown.')
 const parts=q.revisions.at(-1).lines.filter((l:any)=>l.kind==='part')
 if(!Array.isArray(mappings)||mappings.length!==parts.length)fail('OUTREACH_AVAILABILITY','Identify native stock for every quoted part; unknown availability cannot be approved.')
 const sources:any[]=[],needed=new Map<string,number>()
 for(const line of parts){
  const matches=mappings.filter((m:any)=>m.lineId===line.id)
  if(matches.length!==1)fail('OUTREACH_AVAILABILITY','Each quoted part needs one exact native stock source.')
  const mapping=matches[0],stock=find(s,'stockItem',mapping.itemId),bin=find(s,'stockBin',mapping.binId)
  if(bin.location&&bin.location!=='shop')fail('OUTREACH_AVAILABILITY','Only evidenced stock in this shop is supported.')
  const balance=stockBalance(s,stock.id,bin.id),key=stock.id+':'+bin.id,total=(needed.get(key)??0)+line.quantityMilli;needed.set(key,total)
  if(balance.availableMilli<total)fail('OUTREACH_AVAILABILITY','The quoted quantity is not available from this native stock source.')
  const ledger=['stockMovement','stockReservation'].flatMap(kind=>rows(s,kind).filter(r=>r.itemId===stock.id&&r.binId===bin.id).map(r=>({kind,id:r.id,version:r.version}))).sort((a,b)=>a.id.localeCompare(b.id))
  sources.push({lineId:line.id,itemVersion:stock.version,itemName:stock.name,binVersion:bin.version,binName:bin.code,quantityMilli:line.quantityMilli,...balance,ledger})
 }
 return {quoteId:q.id,quoteVersion:q.version,quoteRevision:q.revisions.at(-1).n,jobId:job.id,jobVersion:job.version,startAt:job.startAt,endAt:job.endAt,bayId:bay.id,bayVersion:bay.version,technicianId:tech.id,technicianVersion:tech.version,sources}
}
export function declinedAvailabilityStop(s:State,r:any,now:string){
 const review=rows(s,'declinedAvailability').find(x=>x.id===r.availabilityId)
 if(!review||review.version!==r.availabilityVersion||now>=review.expiresAt)return 'Availability evidence missing or stale'
 try{
  const item=find(s,'declinedWork',r.subjectId),quote=find(s,'estimate',r.estimateId)
  // Mileage observations do not alter booked capacity; its exact plan still binds.
  const {jobVersion:_currentVersion,...current}=nativeDeclinedAvailability(s,item,quote,review.mappings,now),{jobVersion:_reviewVersion,...approved}=review.snapshot
  if(JSON.stringify(current)!==JSON.stringify(approved))return 'Native availability sources changed'
 }catch{return 'Native availability unavailable or unknown'}
 return ''
}
export function declinedContent(instructions:string,totalCents:number){return `${instructions}\nRefreshed quote: USD ${(totalCents/100).toFixed(2)}. Contact the shop to review and book. No work or payment is authorized.`}
export function declinedOutreachCommand(c:Context,command:string,p:any):any{
 if(!['outreach.consent','outreach.withdraw','outreach.availability','outreach.resolve'].includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner records declined-work permission and reviews.',null,403)
 if(command==='outreach.resolve'){
  const row=find(c.s,'outreach',p.id);expectVersion(row,p.version)
  if(row.kind!=='declined'||!['failed','uncertain'].includes(row.status)||row.resolution)fail('OUTREACH_RESOLUTION','Resolve an unresolved failed or uncertain declined-work handoff.')
  const next=bump(c.s,'outreach',row,{resolution:{by:who(c),at:c.now,evidence:text(p.evidence,'human resolution evidence',2000)}})
  event(c,command,row.jobId,row.id,{});return next
 }
 if(command==='outreach.withdraw'){
  const consent=find(c.s,'declinedConsent',p.consentId);expectVersion(consent,p.version)
  if(consent.withdrawnAt)return consent
  const next=bump(c.s,'declinedConsent',consent,{withdrawnAt:c.now,withdrawal:{by:who(c),evidence:text(p.evidence,'customer withdrawal evidence',2000)}})
  for(const row of rows(c.s,'outreach').filter(r=>r.kind==='declined'&&(r.assetId===consent.assetId||r.to===consent.to)&&r.status==='pending'))bump(c.s,'outreach',row,{status:'stopped',stoppedAt:c.now,stopReason:'Customer withdrew declined-work email permission',stoppedBy:who(c)})
  event(c,command,consent.jobId,consent.id,{});return next
 }
 const item=find(c.s,'declinedWork',p.subjectId);expectVersion(item,p.version)
 const asset=find(c.s,'asset',item.assetId)
 if(item.inapplicable||declinedSuppressed(c.s,asset))fail('OUTREACH_STOP','This finding or customer is suppressed.')
 if(command==='outreach.consent'){
  if(p.consent!==true||p.purpose!=='declined-work'||p.wordingVersion!==DECLINED_WORDING_VERSION)fail('OUTREACH_CONSENT','Record affirmative customer permission for this declined item, separately from appointment permission.',null,422)
  const to=text(p.to,'customer recipient',254).toLowerCase()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||to!==declinedRecipient(asset))fail('OUTREACH_RECIPIENT','Use this customer’s current recipient.',null,400)
  const consentedAt=instant(p.consentedAt,'customer permission time with UTC offset')
  if(consentedAt>c.now)fail('INPUT','Customer permission time cannot be in the future.',null,400)
  const row=put(c.s,'declinedConsent',{subjectId:item.id,assetId:asset.id,jobId:item.jobId,customer:declinedCustomer(asset,c.s),to,channel:'email',purpose:'declined-work',wording:declinedWording(item),wordingVersion:DECLINED_WORDING_VERSION,consentedTime:text(p.consentedAt,'original customer permission time',40),consentedAt,captureChannel:choice(p.captureChannel,['customer-form','customer-email','telephone','in-person'],'customer permission source'),sourceEvidence:text(p.sourceEvidence,'customer permission evidence reference',2000),by:who(c),at:c.now,policy:DECLINED_POLICY})
  event(c,command,item.jobId,row.id,{});return row
 }
 const q=find(c.s,'estimate',p.estimateId);expectVersion(q,p.quoteVersion)
 if(q.status!=='approved'||q.authorisation||!item.proposals.some((x:any)=>x.estimateId===q.id))fail('OUTREACH_QUOTE','Review an approved refreshed quote for this declined item.')
 const expiresAt=instant(p.expiresAt,'availability review expiry')
 if(expiresAt<=c.now||Date.parse(expiresAt)-Date.parse(c.now)>31*86400000)fail('INPUT','Availability review needs a future expiry within 31 days.',null,400)
 const snapshot=nativeDeclinedAvailability(c.s,item,q,p.mappings,c.now)
 const row=put(c.s,'declinedAvailability',{subjectId:item.id,assetId:asset.id,jobId:q.jobId,estimateId:q.id,quoteVersion:q.version,nativeTechnician:p.nativeTechnician,mappings:snapshot.sources.map(r=>({lineId:r.lineId,itemId:r.itemId,binId:r.binId})),snapshot,expiresAt,evidence:text(p.evidence,'availability review evidence',2000),by:who(c),at:c.now,policy:DECLINED_POLICY})
 event(c,command,q.jobId,row.id,{});return row
}
