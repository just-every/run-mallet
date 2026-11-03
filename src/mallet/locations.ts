import {conflicts,slot} from './workshop'
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type Row,type State} from './model'
import {taxRate} from './tax'

export const locationCommands=['location.save','location.bin','location.transferRepair','location.metrics']
export const recordLocation=(s:State,kind:string,row:Row):string=>{
 if(row.locationId)return row.locationId
 if(row.jobId){const job=rows(s,'job').find(j=>j.id===row.jobId);if(job)return recordLocation(s,'job',job)}
 if(row.invoiceId){const invoice=rows(s,'invoice').find(i=>i.id===row.invoiceId);if(invoice)return recordLocation(s,'invoice',invoice)}
 if(row.purchaseId){const order=rows(s,'purchaseOrder').find(o=>o.id===row.purchaseId);if(order)return recordLocation(s,'purchaseOrder',order)}
 if(row.binId){const bin=rows(s,'stockBin').find(b=>b.id===row.binId);if(bin)return recordLocation(s,'stockBin',bin)}
 return row.location??'shop'
}
export function locationRecord(s:State,id:unknown){return find(s,'location',id)}
export function locationFields(s:State,id:unknown){
 if(id===undefined||id==='shop')return {}
 const location=locationRecord(s,id)
 const {code,name,state,timeZone,hours,invoicePrefix,tax,version}=location
 return {locationId:location.id,locationSnapshot:structuredClone({id:location.id,version,code,name,state,timeZone,hours,invoicePrefix,tax})}
}
export function locationMetrics(s:State){
 const ids=['shop',...rows(s,'location').sort((a,b)=>a.code.localeCompare(b.code)).map(l=>l.id)]
 const groups=ids.map(locationId=>{
  const jobs=rows(s,'job').filter(j=>recordLocation(s,'job',j)===locationId),invoices=rows(s,'invoice').filter(i=>i.status!=='draft'&&recordLocation(s,'invoice',i)===locationId)
  const invoiceIds=new Set(invoices.map(i=>i.id)),credits=rows(s,'creditNote').filter(n=>invoiceIds.has(n.invoiceId))
  return {locationId,repairs:jobs.length,invoiceCount:invoices.length,grossCents:invoices.reduce((n,i)=>n+i.totals.totalCents,0),creditCents:credits.reduce((n,i)=>n+i.totals.totalCents,0),netCents:invoices.reduce((n,i)=>n+i.totals.totalCents,0)-credits.reduce((n,i)=>n+i.totals.totalCents,0)}
 })
 return {currency:'USD',basis:'Approved and exported invoices less issued credit notes. Recorded revenue only; no settlement or fund movement.',groups,total:groups.reduce((a,g)=>({repairs:a.repairs+g.repairs,invoiceCount:a.invoiceCount+g.invoiceCount,grossCents:a.grossCents+g.grossCents,creditCents:a.creditCents+g.creditCents,netCents:a.netCents+g.netCents}),{repairs:0,invoiceCount:0,grossCents:0,creditCents:0,netCents:0})}
}
export const locations:Handler=(c,command,p)=>{
 if(!locationCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages locations and consolidated results.',null,403)
 if(command==='location.metrics')return locationMetrics(c.s)
 const reason=text(p.reason,'owner review reason',2000)
 if(command==='location.save'){
  const previous=p.id?locationRecord(c.s,p.id):null
  if(previous)expectVersion(previous,p.version)
  const code=text(p.code,'location code',20),state=text(p.state,'US state',2),timeZone=text(p.timeZone,'IANA timezone',100),invoicePrefix=text(p.invoicePrefix,'invoice prefix',20)
  if(!'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ').includes(state)||!/^[-A-Z0-9]+$/.test(code)||!/^[-A-Z0-9]+$/.test(invoicePrefix)||invoicePrefix==='M')fail('INPUT','Use a two-letter state, uppercase location code and distinct invoice prefix.',null,400)
  try{new Intl.DateTimeFormat('en-US',{timeZone}).format(0)}catch{fail('INPUT','Choose a known IANA timezone.',null,400)}
  if(!Array.isArray(p.hours)||p.hours.length!==7)fail('INPUT','Declare all seven local days, using null for a closed day.',null,400)
  const hours=p.hours.map((day:any)=>{if(day===null)return null;const open=integer(day.open,'opening minute',0,1439),close=integer(day.close,'closing minute',1,1440);if(open>=close)fail('INPUT','Opening must precede closing within each local day.',null,400);return {open,close}})
  if(typeof p.partsTaxable!=='boolean'||typeof p.laborTaxable!=='boolean')fail('INPUT','Declare part and labor tax treatment.',null,400)
  if(rows(c.s,'location').some(l=>l.id!==previous?.id&&(l.code===code||l.invoicePrefix===invoicePrefix)))fail('DUPLICATE','Location codes and invoice prefixes must be unique.')
  if(previous&&previous.invoicePrefix!==invoicePrefix&&rows(c.s,'job').some(j=>j.locationId===previous.id))fail('LOCATION_FROZEN','A location used by a repair retains its invoice prefix.')
  const fields={code,name:text(p.name,'location name'),state,timeZone,hours,invoicePrefix,tax:{...taxRate(p.ratePercent),partsTaxable:p.partsTaxable,laborTaxable:p.laborTaxable,currency:'USD'},merchantReference:text(p.merchantReference,'merchant routing reference'),ledgerReference:text(p.ledgerReference,'ledger routing reference'),reason,by:who(c),at:c.now}
  const saved=previous?bump(c.s,'location',previous,fields):put(c.s,'location',fields);event(c,command,null,saved.id,{before:previous,after:saved});return saved
 }
 if(command==='location.bin'){
  const location=locationRecord(c.s,p.locationId),bin=find(c.s,'stockBin',p.binId);expectVersion(bin,p.version)
  if(rows(c.s,'stockMovement').some(m=>m.binId===bin.id)||rows(c.s,'stockLot').some(l=>l.binId===bin.id)||rows(c.s,'stockTransfer').some(t=>t.sourceBinId===bin.id||t.destinationBinId===bin.id))fail('LOCATION_FROZEN','Assign an empty unused bin; move existing stock through transfer custody.')
  const saved=bump(c.s,'stockBin',bin,{locationId:location.id,location:location.id});event(c,command,null,bin.id,{locationId:location.id,reason});return saved
 }
 const job=find(c.s,'job',p.jobId),asset=find(c.s,'asset',job.assetId),destination=locationRecord(c.s,p.locationId);expectVersion(job,p.version);expectVersion(asset,p.assetVersion)
 if(p.confirm!=='transfer-repair')fail('INPUT','Explicitly confirm repair and vehicle custody transfer.',null,400)
 if(job.status!=='booked'||job.estimateId||job.actuals.length||rows(c.s,'stockReservation').some(r=>r.jobId===job.id&&!r.release)||rows(c.s,'job').some(j=>j.id!==job.id&&j.assetId===asset.id&&['booked','working'].includes(j.status)))fail('LOCATION_TRANSFER','Transfer only an unestimated booked repair with no reservations or other open vehicle visit.')
 if(recordLocation(c.s,'job',job)===destination.id)fail('LOCATION_TRANSFER','Choose a different destination.')
 const transfer=put(c.s,'locationTransfer',{jobId:job.id,assetId:asset.id,from:recordLocation(c.s,'job',job),to:destination.id,reason,evidence:text(p.evidence,'vehicle custody evidence',2000),by:who(c),at:c.now})
 const plan=slot({...job,...p,locationId:destination.id})
 if(conflicts(c.s,plan,job.id).length)fail('DISPATCH_CONFLICT','Destination resources are occupied.')
 const saved=bump(c.s,'job',job,{...locationFields(c.s,destination.id),...plan})
 bump(c.s,'asset',asset,{locationId:destination.id});event(c,command,job.id,transfer.id,transfer);return saved
}
