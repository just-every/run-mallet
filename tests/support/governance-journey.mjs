import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {archive,restore,installation,booking,estimate,snapshots} from '../harness.mjs'
import {creditAccountFixture,creditInvoice,creditInput} from './refunds-journey.mjs'
export const grantInput=(operatorId,role,version=0,limits={})=>({operatorId,role,version,location:'shop',discountBps:500,spendCents:1000,refundCents:200,costRight:false,confirm:'grant-staff',reason:'Owner reviewed the staff responsibility',...limits})
// Real private media doors; the expected transition set is independent of the
// exported ledger. Replays must not masquerade as additional changes.
export function auditCsvEntries(text){
 const lines=text.trimEnd().split('\r\n').slice(1)
 return lines.map(line=>{
  const cells=[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replaceAll('""','"'))
  assert.equal(cells.length,7)
  const [id,action,at,actor,policy,changes,evidence]=cells
  return {id,action,at,actor:JSON.parse(actor),policy,changes:JSON.parse(changes),evidence:JSON.parse(evidence)}
 })
}
async function auditSnapshot(h){
 const entries=[];let offset=0
 do{
  const page=await h.api('/api/mallet/audit?'+new URLSearchParams({offset:String(offset)}))
  entries.push(...page.entries);offset=page.nextOffset
 }while(offset!==null)
 return entries
}
export async function mediaAuditJourney(h){
 const denied=async(path,input,options)=>{
  const before=await auditSnapshot(h)
  await h.api(path,input,options)
  assert.deepEqual(await auditSnapshot(h),before,'Denied write leaves the entire audit unchanged: '+path)
 }
 const tech=await h.person('synthetic-mallet-media-audit@example.test'),other=await h.person('synthetic-mallet-media-denied@example.test')
 const assetInput=await h.command('asset.create',{customerName:'Synthetic media audit',label:'Audit vehicle',identifier:'synthetic-mallet-media-audit'})
 const {asset,job}=await booking(h,{asset:assetInput,technicianId:tech.id,startAt:'2026-09-01T09:00:00Z',endAt:'2026-09-01T10:00:00Z'})
 const next=(await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),technicianId:tech.id,startAt:'2026-10-01T09:00:00Z',endAt:'2026-10-01T10:00:00Z'})).job
 const path='/api/mallet/media',as={as:tech.cookie},input={jobId:job.id,clientId:randomUUID(),title:'Private measured finding',capturedAt:'2026-09-01T09:15:00Z',observation:{measurements:[{name:'Private measurement',value:3,unit:'mm'}],recommendation:'Private recommendation payload',provenance:{kind:'native'}}}
 const finding=await h.api(path+'/findings',input,as)
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'),sha256=createHash('sha256').update(bytes).digest('hex')
 const uploadInput={findingId:finding.id,clientId:randomUUID(),variant:'original',filename:'private-evidence.png',mime:'image/png',size:bytes.length,sha256,capturedAt:finding.capturedAt}
 let upload=await h.api(path+'/uploads',uploadInput,as)
 await denied(path+'/uploads/'+upload.id+'/complete',{}, {...as,status:409})
 await h.api(path+'/uploads/'+upload.id+'/chunks/0',{sha256,base64:bytes.toString('base64')},{...as,method:'PUT'})
 upload=await h.api(path+'/uploads/'+upload.id+'/complete',{},as)
 const carryInput={jobId:next.id,findingId:finding.id},carried=await h.api(path+'/carry',carryInput,as)
 const query=new URLSearchParams({q:finding.id,actor:tech.id}),url='/api/mallet/audit?'+query
 const beforeReplay=await auditSnapshot(h)
 assert.deepEqual(await h.api(path+'/findings',input,as),finding)
 assert.equal((await h.api(path+'/uploads',uploadInput,as)).id,upload.id)
 assert.deepEqual(await h.api(path+'/uploads/'+upload.id+'/complete',{},as),upload)
 await h.api(path+'/uploads/'+upload.id+'/chunks/0',{sha256,base64:bytes.toString('base64')},{...as,method:'PUT'})
 assert.deepEqual(await h.api(path+'/carry',carryInput,as),carried)
 assert.deepEqual(await auditSnapshot(h),beforeReplay,'Exact replays create no transition receipts anywhere in the audit')
 const reason={reason:'Private resolution payload'},resolution=await h.api(path+'/findings/'+finding.id+'/resolve',reason,as)
 const entries=(await h.api(url)).entries
 const expected=[
  ['media.finding.created',[{kind:'mediaFinding',id:finding.id,beforeRevision:null,afterRevision:1}]],
  ['media.upload.created',[{kind:'mediaUpload',id:upload.id,beforeRevision:null,afterRevision:1}]],
  ['media.chunk.received',[{kind:'mediaChunk',id:upload.id+':0',beforeRevision:null,afterRevision:1}]],
  ['media.upload.completed',[{kind:'mediaUpload',id:upload.id,beforeRevision:1,afterRevision:2}]],
  ['media.finding.carried',[{kind:'mediaFinding',id:carried.id,beforeRevision:null,afterRevision:1}]],
  ['media.finding.resolved',[{kind:'mediaFinding',id:finding.id,beforeRevision:1,afterRevision:2},{kind:'mediaResolution',id:finding.id,beforeRevision:null,afterRevision:1}]]
 ]
 assert.deepEqual(entries.map(e=>e.action).sort(),expected.map(([action])=>action).sort(),'Every actual transition appears exactly once')
 for(const [action,changes] of expected){const entry=entries.find(e=>e.action===action);assert.deepEqual(entry.changes,changes,action+' exact revisions');assert.equal(entry.actor.id,tech.id);assert.ok(entry.evidence.includes('finding:'+finding.id)||entry.evidence.includes('source-finding:'+finding.id));assert.ok(Number.isFinite(Date.parse(entry.at)))}
 assert.equal(upload.revision,2);assert.equal((await h.api(path+'/findings?jobId='+job.id)).findings[0].revision,2)
 const carryEntry=entries.find(e=>e.action==='media.finding.carried');assert.ok(carryEntry.evidence.includes('source-job:'+job.id));assert.ok(carryEntry.evidence.includes('job:'+next.id))
 const beforeResolutionReplay=await auditSnapshot(h)
 assert.deepEqual(await h.api(path+'/findings/'+finding.id+'/resolve',reason,as),resolution)
 assert.deepEqual(await auditSnapshot(h),beforeResolutionReplay,'Resolution replay creates no audit receipt')
 await denied(path+'/findings/'+finding.id+'/resolve',{reason:'Changed replay'}, {...as,status:409})
 await denied(path+'/findings',{...input,title:'Changed replay'}, {...as,status:409})
 await denied(path+'/findings',{...input,clientId:randomUUID()},{as:other.cookie,status:404})
 for(const [door,body,method] of [
  ['/uploads',uploadInput,'POST'],
  ['/uploads/'+upload.id+'/chunks/0',{sha256,base64:bytes.toString('base64')},'PUT'],
  ['/uploads/'+upload.id+'/complete',{},'POST'],
  ['/carry',carryInput,'POST'],
  ['/findings/'+finding.id+'/resolve',reason,'POST']
 ])await denied(path+door,body,{as:other.cookie,method,status:404})
 await denied(path+'/findings',{...input,clientId:randomUUID()},{headers:{origin:'https://elsewhere.test'},status:403})
 await h.api('/auth/operator/status',{operatorId:tech.id,status:'inactive'})
 await denied(path+'/findings',{...input,clientId:randomUUID()},{...as,status:401})
 await denied(path+'/uploads/'+upload.id+'/complete',{}, {...as,status:401})
 await denied(path+'/findings/'+finding.id+'/resolve',reason,{...as,status:401})
 const exported=await h.api(url+'&format=json');assert.deepEqual(exported.entries,entries)
 assert.deepEqual(auditCsvEntries(await (await h.request(url+'&format=csv')).text()),entries.map(({version,...entry})=>entry),'CSV and JSON retain identical revision and evidence references')
 const serialized=JSON.stringify(entries)
 for(const privateValue of [bytes.toString('base64'),input.title,input.observation.recommendation,reason.reason,uploadInput.filename,tech.cookie,'test-mail-edge'])assert.ok(!serialized.includes(privateValue),'Audit contains references without private payloads or credentials')
 for(const format of ['json','csv'])await h.api(url+'&format='+format,undefined,{as:other.cookie,status:403})
 return {entries,finding,upload,carried,job,next,actorId:tech.id,url}
}
export async function auditJourney(h){
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
 const media=await mediaAuditJourney(h)
 const admin=await h.person('synthetic-mallet-audit@example.test','admin'),member=await h.person('synthetic-mallet-tech@example.test')
 const {job}=await booking(h),q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Discounted repair',quantity:1,unitCents:1000,unitDiscountCents:100}]},{as:admin.cookie})
 const item=await h.command('stock.item',{sku:'synthetic-mallet-audit',name:'Audit part',unit:'each',barcode:'synthetic-mallet-item'}),bin=await h.command('stock.bin',{code:'Audit bin',barcode:'synthetic-mallet-bin'})
 const count=await h.command('stock.count',{itemBarcode:item.barcode,binBarcode:bin.barcode,quantity:2,mode:'cycle',reason:'Counted physically'})
 await h.command('stock.approveCount',{countId:count.id,version:count.version,reason:'Reviewed count variance'},{as:admin.cookie})
 const key=await h.command('agent.create',{label:'Audit proposal agent'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 const proposal=await h.command('dispatch.prepare',{jobId:job.id,version:(await h.state()).records.job.find(j=>j.id===job.id).version,bayId:'Audit bay',technicianId:(await h.state()).actor.id,startAt:'2026-11-02T09:00:00Z',endAt:'2026-11-02T10:00:00Z',reason:'Reviewed dispatch proposal'},agent)
 const {account}=await creditAccountFixture(h),{invoice}=await creditInvoice(h,account,'9')
 const payment=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:541,method:'cash',reference:'synthetic-mallet-audit-cash',evidence:'Cash counted'})
 const input=creditInput(invoice,payment,'synthetic-mallet-audit-refund'),review=await h.command('credit.preview',input),note=await h.command('credit.issue',{...input,review,confirm:'issue-credit'})
 const refund=(await h.state()).records.refund.find(r=>r.creditNoteId===note.id)
 await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'refunded',reference:'synthetic-mallet-audit-return',evidence:'Original cash returned',confirm:'record-refund'})
 await h.api('/auth/operator/status',{operatorId:admin.id,status:'inactive'})
 await h.command('agent.revoke',{id:key.id})
 await h.state({as:admin.cookie,status:401});await h.state({...agent,status:401})
 const report=await h.api('/api/mallet/audit'),entries=report.entries
 assert.ok(entries.some(e=>e.action==='auth.session.created'&&e.actor.id===member.id),'Ordinary email-link login is retained without session credentials')
 const retention=await h.command('retention.policy',{version:0,mediaDays:null,personalDays:null,auditMinimumDays:365,reason:'Owner minimum audit retention label; preserve all evidence',consent:true})
 assert.equal(retention.auditMinimumDays,365);assert.equal((await h.api('/api/mallet/audit')).auditMinimumDays,365)
 await h.command('retention.policy',{version:retention.version,mediaDays:null,personalDays:null,auditMinimumDays:-1,reason:'Invalid label',consent:true},{status:400})

 for(const action of ['estimate.prepare','stock.approveCount','dispatch.prepare','credit.issue','refund.record','auth.mallet:agent.revoked'])assert.ok(entries.some(e=>e.action===action),action)
 const overridden=entries.find(e=>e.action==='estimate.prepare'&&e.actor.id===admin.id)
 assert.ok(overridden);assert.ok(overridden.changes.some(c=>c.kind==='estimate'&&c.id===q.id&&c.beforeRevision===null&&c.afterRevision===1))
 assert.ok(entries.find(e=>e.action==='dispatch.prepare').evidence.includes('proposal:'+proposal.id))
 assert.ok(entries.find(e=>e.action==='stock.approveCount').changes.some(c=>c.kind==='stockCount'&&c.beforeRevision===1&&c.afterRevision===2))
 const filtered=await h.api('/api/mallet/audit?'+new URLSearchParams({q:q.id,actor:admin.id,action:'estimate.prepare',from:overridden.at.slice(0,10),to:overridden.at.slice(0,10)}))
 assert.equal(filtered.entries.length,1);assert.equal(filtered.entries[0].id,overridden.id)
 const text=JSON.stringify(report);assert.ok(!text.includes(key.token));assert.ok(!text.includes('test-mail-edge'))
 const csv=await h.request('/api/mallet/audit?format=csv');assert.match(csv.headers.get('content-disposition'),/attachment/);assert.match(await csv.text(),/beforeRevision/)
 const exported=await h.request('/api/mallet/audit?format=json');assert.match(exported.headers.get('content-disposition'),/attachment/);assert.deepEqual((await exported.json()).entries,(await h.api('/api/mallet/audit')).entries,'Export retains the exact stored revision and evidence references')
 await h.api('/api/mallet/audit?from=2026-02-30',undefined,{status:400});await h.api('/api/mallet/audit?offset=-1',undefined,{status:400})
 await h.api('/auth/operator/status',{operatorId:admin.id,status:'active'});const restoredAdmin=await h.signInAs('synthetic-mallet-audit@example.test');for(const cookie of [member.cookie,restoredAdmin])for(const path of ['/app/audit','/api/mallet/audit','/api/mallet/audit?format=json','/api/mallet/audit?format=csv'])assert.equal((await h.request(path,{as:cookie})).status,403,'Non-owner cannot inspect private audit')
 assert.equal((await h.state({as:member.cookie})).records.audit,undefined)
 const source=await snapshots(),plan=await h.api('/api/mallet/imports/preview',source),imported=await h.api('/api/mallet/imports/apply',{...source,fingerprint:plan.fingerprint});await h.api('/api/mallet/imports/undo',{id:imported.id});const imports=await h.api('/api/mallet/audit?q=import.');assert.ok(imports.entries.length>=2);const ownerId=(await h.state()).actor.id;assert.ok(imports.entries.every(x=>x.actor.id===ownerId))
 const retained=(await h.api('/api/mallet/audit')).entries;await h.cron('2099-01-01T12:00:00Z');await h.restart();const afterMaintenance=(await h.api('/api/mallet/audit')).entries;for(const entry of retained)assert.deepEqual(afterMaintenance.find(x=>x.id===entry.id),entry,'Scheduled maintenance and restart never delete audit evidence')
 const original=afterMaintenance,backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);assert.deepEqual((await fresh.api(media.url)).entries,media.entries,'Fresh-owner recovery retains exact media transitions');const recovered=(await fresh.api('/api/mallet/audit')).entries;for(const entry of original)assert.deepEqual(recovered.find(x=>x.id===entry.id),entry);await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
}
export async function staffJourney(h){
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
 const people={};for(const role of ['advisor','manager','purchaser','cashier','accountant'])people[role]=await h.person('synthetic-mallet-'+role+'@example.test')
 const admin=await h.person('synthetic-mallet-grants@example.test','admin')
 await h.command('staff.grant',grantInput(people.advisor.id,'advisor'),{as:admin.cookie,status:403})
 const noProof=(await h.state()).records;await h.command('staff.grant',grantInput(people.advisor.id,'advisor'),{status:403});assert.deepEqual((await h.state()).records,noProof,'Grant without fresh confirmation writes nothing')
 const unlimited=await h.person('synthetic-mallet-no-limits@example.test');const zero=grantInput(unlimited.id,'manager');delete zero.discountBps;delete zero.spendCents;delete zero.refundCents
 await h.command('staff.grant',zero);const noLimitBefore=(await h.state()).records
 for(const path of ['/app/staff','/api/mallet/staff/state','/api/mallet/staff/state?download=1'])assert.equal((await h.request(path,{as:unlimited.cookie})).status,403)
 await h.command('asset.create',{customerName:'No authority',label:'Refused',identifier:'synthetic-mallet-zero'},{as:unlimited.cookie,status:403});assert.deepEqual((await h.state()).records,noLimitBefore,'A grant without limits allows no delegated door or write')
 const grant=await h.command('staff.grant',grantInput(people.advisor.id,'advisor'))
 for(const role of ['manager','purchaser','cashier','accountant'])await h.command('staff.grant',grantInput(people[role].id,role))
 for(const [role,person] of Object.entries(people)){
  const view=await h.api('/api/mallet/staff/state',undefined,{as:person.cookie});assert.equal(view.actor.role,role)
  assert.equal((await h.request('/app/staff',{as:person.cookie})).status,200)
  assert.equal((await h.request('/api/mallet/staff/state?download=1',{as:person.cookie})).status,200)
  const outside=(await h.state()).records
  for(const path of ['/api/mallet/state','/api/mallet/audit','/api/mallet/reports/sales','/app/staff-access','/api/portability/exports','/api/mallet/media/fake'])assert.equal((await h.request(path,{as:person.cookie})).status,403,role+' denied '+path)
  await h.command('staff.grant',grantInput(admin.id,'manager'),{as:person.cookie,status:403});assert.deepEqual((await h.state()).records,outside,'Unlisted doors leave product and audit data unchanged')
 }
 const {job}=await booking(h),lines=[{kind:'part',description:'Governed discount',quantity:1,unitCents:1000,unitDiscountCents:51}]
 const before=await h.state()
 await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines},{as:people.advisor.cookie,status:403});assert.deepEqual((await h.state()).records,before.records)
 const q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{...lines[0],unitDiscountCents:50}]},{as:people.advisor.cookie})
 assert.equal(q.revisions[0].preparedBy.staffRole,'advisor')
 await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1},{as:people.manager.cookie})
 const otherLocationBefore=(await h.state()).records
 await h.command('asset.create',{customerName:'Other shop',label:'Denied',identifier:'synthetic-mallet-other-location',location:'other'},{as:people.manager.cookie,status:403});assert.deepEqual((await h.state()).records,otherLocationBefore,'Other location refusal writes nothing')
 const item=await h.command('stock.item',{sku:'synthetic-mallet-role',name:'Role part',unit:'each',barcode:'synthetic-mallet-role-barcode'},{as:people.purchaser.cookie})
 const po={reference:'synthetic-mallet-po',supplier:'Synthetic supplier',shipTo:'Shop',expectedAt:'2026-11-05T09:00:00Z',taxCents:0,freightCents:0,lines:[{itemId:item.id,quantity:1,unitCents:1001,jobId:job.id}]}
 await h.command('purchase.create',{...po,lines:[{...po.lines[0],unitCents:1000}]},{as:people.purchaser.cookie,status:403})
 assert.equal((await h.api('/api/mallet/staff/state',undefined,{as:people.purchaser.cookie})).records.purchaseOrder,undefined)
 await h.command('staff.grant',grantInput(people.purchaser.id,'purchaser',1,{costRight:true}));await h.command('staff.grant',grantInput(people.manager.id,'manager',1,{costRight:true}))
 const stockBefore=(await h.state()).records
 await h.command('purchase.create',po,{as:people.purchaser.cookie,status:403});assert.deepEqual((await h.state()).records,stockBefore)
 const order=await h.command('purchase.create',{...po,lines:[{...po.lines[0],unitCents:1000}]},{as:people.purchaser.cookie});await h.command('purchase.approve',{purchaseId:order.id,version:order.version,reason:'Within owner limit'},{as:people.manager.cookie})
 const {account}=await creditAccountFixture(h),{invoice}=await creditInvoice(h,account,'8')
 await h.stepUp(people.cashier.cookie)
 const pay=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:541,method:'cash',reference:'synthetic-mallet-cashier',evidence:'Cash counted'},{as:people.cashier.cookie})
 const input=creditInput(invoice,pay,'synthetic-mallet-refund-limit',invoice.lines[0],2);await h.command('credit.preview',input,{as:people.cashier.cookie,status:403});const ownerReview=await h.command('credit.preview',input),refundBefore=(await h.state()).records;await h.command('credit.issue',{...input,review:ownerReview,confirm:'issue-credit'},{as:people.cashier.cookie,status:403});assert.deepEqual((await h.state()).records,refundBefore)
 const small=creditInput(invoice,pay,'synthetic-mallet-refund-authorized'),smallReview=await h.command('credit.preview',small,{as:people.cashier.cookie})
 const note=await h.command('credit.issue',{...small,review:smallReview,confirm:'issue-credit'},{as:people.cashier.cookie});assert.equal(note.totals.totalCents,109)
 const read=await h.api('/api/mallet/staff/state',undefined,{as:people.accountant.cookie});assert.ok(read.balances.some(x=>x.invoiceId===invoice.id));assert.ok(!JSON.stringify(read).includes('consentEvidence'));await h.command('payment.record',{}, {as:people.accountant.cookie,status:403})
 assert.ok((await h.api('/api/mallet/staff/state',undefined,{as:people.purchaser.cookie})).records.purchaseOrder.length)
 await delegatedPurchasingJourney(h,people,{item,order,po})
 const current=(await h.state()).records,backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records,current,'Purchase receipts, reservations and every supplier bill version recover exactly');for(const role of ['purchaser','manager']){await fresh.api('/api/mallet/staff/state?download=1',undefined,{as:people[role].cookie,status:401});await fresh.command('purchase.bill',{purchaseId:order.id,version:order.version},{as:people[role].cookie,status:401})}assert.equal(await (await fresh.mf.getD1Database('DB')).prepare('SELECT count(*) AS n FROM mallet_staff_grants').first('n'),0);assert.equal(await (await fresh.mf.getD1Database('DB')).prepare('SELECT count(*) AS n FROM mallet_location_staff_grants').first('n'),0);assert.ok((await fresh.api('/api/mallet/audit?action=staff.grant')).entries.length>=5)}finally{await fresh.close()}
 await h.command('staff.revoke',grantInput(people.advisor.id,'advisor',grant.version))
 assert.equal((await h.request('/app/staff',{as:people.advisor.cookie})).status,403)
 await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines},{as:people.advisor.cookie,status:403})
 const grantAudit=(await h.api('/api/mallet/audit')).entries.filter(e=>['staff.grant','staff.revoke'].includes(e.action));assert.equal(grantAudit.length,11);for(const entry of grantAudit){assert.equal(entry.actor.id,(await h.state()).actor.id);assert.equal(entry.changes.length,1);assert.equal(entry.changes[0].kind,'staffGrant');assert.equal(entry.changes[0].afterRevision,(entry.changes[0].beforeRevision??0)+1)}
 await h.api('/auth/operator/status',{operatorId:people.purchaser.id,status:'inactive'});await h.api('/api/mallet/staff/state',undefined,{as:people.purchaser.cookie,status:401})
}

async function delegatedPurchasingJourney(h,people,{item,order,po}){
 const as={as:people.purchaser.cookie},bin=await h.command('stock.bin',{code:'Purchaser receiving',barcode:'synthetic-mallet-purchaser-bin'},as)
 let current=(await h.state()).records.purchaseOrder.find(p=>p.id===order.id)
 const refs=()=>({purchaseId:current.id,version:current.version}),refresh=async()=>{current=(await h.state()).records.purchaseOrder.find(p=>p.id===order.id)}
 const denied=async(command,input,status=409,options=as)=>{const before=(await h.state()).records;await h.command(command,input,{...options,status});assert.deepEqual((await h.state()).records,before,command+' refusal leaves all product and audit records unchanged')}
 const otherBin=await h.command('stock.bin',{code:'Other location receiving',barcode:'synthetic-mallet-other-bin'})
 await h.command('stock.location',{binId:otherBin.id,version:otherBin.version,location:'other'})
 const otherInput={...po,reference:'synthetic-mallet-other-po',binId:otherBin.id,lines:[{...po.lines[0],unitCents:500}]}
 await denied('purchase.create',otherInput,403)
 let other=await h.command('purchase.create',otherInput)
 await denied('purchase.approve',{purchaseId:other.id,version:other.version,reason:'Other location is outside the grant'},403)
 other=await h.command('purchase.approve',{purchaseId:other.id,version:other.version,reason:'Owner controls the other location'})
 const otherReceipt={purchaseId:other.id,version:other.version,lineId:other.lines[0].id,itemBarcode:item.barcode,binBarcode:otherBin.barcode,quantity:1,reference:'synthetic-mallet-other-receipt'}
 await denied('purchase.receive',otherReceipt,403)
 const receipt=await h.command('purchase.receive',otherReceipt)
 other=(await h.state()).records.purchaseOrder.find(p=>p.id===other.id)
 const otherBillInput={purchaseId:other.id,version:other.version,invoiceNumber:'synthetic-mallet-other-bill',lines:[{lineId:other.lines[0].id,quantity:1,unitCents:500}],taxCents:0,freightCents:0,evidence:'Other location private supplier history'}
 await denied('purchase.bill',otherBillInput,403)
 const otherBill=await h.command('purchase.bill',otherBillInput)
 other=(await h.state()).records.purchaseOrder.find(p=>p.id===other.id)
 for(const command of ['purchase.close','purchase.shortClose'])await denied(command,{purchaseId:other.id,version:other.version,reason:'Other shop is denied'},403)
 const otherCount=await h.command('stock.count',{itemBarcode:item.barcode,binBarcode:otherBin.barcode,quantity:1,mode:'blind',reason:'Owner observed the other shop'})
 await denied('stock.approveCount',{countId:otherCount.id,version:otherCount.version,reason:'Other count is denied'},403)
 for(const role of ['purchaser','manager']){
  const options={as:people[role].cookie},projection=await h.api('/api/mallet/staff/state',undefined,options),download=await h.request('/api/mallet/staff/state?download=1',options)
  assert.deepEqual(await download.json(),projection)
  const serialized=JSON.stringify(projection)
  for(const privateValue of [other.id,otherBin.id,receipt.id,otherBill.id,otherCount.id,otherInput.reference,otherBillInput.evidence])assert.ok(!serialized.includes(privateValue),role+' cannot read linked other-location records')
 }
 for(const role of ['advisor','cashier','accountant'])for(const command of ['purchase.create','purchase.approve','purchase.receive','purchase.bill','purchase.shortClose','purchase.close'])await denied(command,{},403,{as:people[role].cookie})
 for(const command of ['purchase.submit','purchase.reconcile','stock.transferReceive','agent.create','retention.erase'])await denied(command,{},403)
 const over=await h.command('purchase.create',{...po,reference:'synthetic-mallet-over-limit'})
 await denied('purchase.approve',{purchaseId:over.id,version:over.version,reason:'Too much spend'},403)
 const receive=()=>({...refs(),lineId:current.lines[0].id,itemBarcode:item.barcode,binBarcode:bin.barcode,quantity:0.5,reference:'synthetic-mallet-purchaser-receipt-1'})
 await denied('purchase.receive',{...receive(),version:order.version})
 const first=receive();await h.command('purchase.receive',first,as);await refresh()
 await denied('purchase.receive',first)
 let inventory=await h.api('/api/mallet/inventory')
 assert.equal(inventory.balances.find(b=>b.itemId===item.id&&b.binId===bin.id).onHandMilli,500)
 assert.equal(inventory.balances.find(b=>b.itemId===item.id&&b.binId===bin.id).reservedMilli,500)
 assert.equal(inventory.balances.find(b=>b.itemId===item.id&&b.binId===bin.id).availableMilli,0)
 const bill=()=>({...refs(),invoiceNumber:'synthetic-mallet-purchaser-bill',lines:[{lineId:current.lines[0].id,quantity:1,unitCents:1000}],taxCents:0,freightCents:0,evidence:'Private supplier original retained by the owner'})
 const exception=await h.command('purchase.bill',{...bill(),lines:[{lineId:current.lines[0].id,quantity:1,unitCents:900}]},as);await refresh()
 assert.equal(exception.matched,false);assert.ok(exception.exceptions.some(e=>e.includes('unit cost')));assert.ok(exception.exceptions.some(e=>e.includes('quantities')))
 await denied('purchase.close',{...refs(),reason:'A bill exception cannot close the order'})
 await h.command('purchase.receive',{...receive(),reference:'synthetic-mallet-purchaser-receipt-2'},as);await refresh()
 await denied('purchase.bill',{...bill(),version:current.version-1})
 const matched=await h.command('purchase.bill',bill(),as);await refresh()
 assert.equal(matched.matched,true);assert.equal(matched.sequence,2);assert.equal(matched.totalCents,1000);assert.equal(matched.receiptIds.length,2)
 await h.command('purchase.close',{...refs(),reason:'All physical goods and exact bill matched'},as);await refresh()
 const view=await h.api('/api/mallet/staff/state',undefined,as),download=await h.request('/api/mallet/staff/state?download=1',as)
 assert.match(download.headers.get('content-disposition'),/attachment/);assert.deepEqual(await download.json(),view)
 assert.deepEqual(view.records.purchaseBill.filter(b=>b.purchaseId===current.id).sort((a,b)=>a.sequence-b.sequence).map(b=>[b.sequence,b.matched,b.totalCents]),[[1,false,900],[2,true,1000]])
 assert.deepEqual(view.stockBalances.find(b=>b.itemId===item.id&&b.binId===bin.id),{itemId:item.id,binId:bin.id,item:item.name,bin:bin.code,onHandMilli:1000,reservedMilli:1000,availableMilli:0})
 assert.equal(view.records.purchaseReceipt.filter(r=>r.purchaseId===current.id).reduce((n,r)=>n+r.quantityMilli,0),1000)
 assert.equal(view.records.stockReservation.filter(r=>r.source.purchaseId===current.id).reduce((n,r)=>n+r.quantityMilli,0),1000)
 assert.ok(!JSON.stringify(view).includes('Private supplier original'));assert.ok(view.records.job.every(j=>Object.keys(j).sort().join(',')==='id,status,title,version'))
 await h.command('staff.revoke',grantInput(people.purchaser.id,'purchaser',2))
 for(const path of ['/app/staff','/api/mallet/staff/state','/api/mallet/staff/state?download=1'])assert.equal((await h.request(path,as)).status,403)
 await denied('purchase.create',{...po,reference:'synthetic-mallet-revoked'},403)
 await denied('purchase.bill',bill(),403)
 await h.command('staff.grant',grantInput(people.purchaser.id,'purchaser',3,{costRight:false}))
 const hidden=await h.api('/api/mallet/staff/state',undefined,as)
 assert.equal(hidden.records.purchaseOrder,undefined);assert.equal(hidden.records.purchaseBill,undefined);assert.equal(hidden.records.job,undefined)
 assert.ok(!JSON.stringify(hidden).includes('Private supplier original'))
 await denied('purchase.create',{...po,reference:'synthetic-mallet-no-cost'},403)
}
