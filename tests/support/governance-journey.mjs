import assert from 'node:assert/strict'
import {archive,restore,installation,booking,estimate,snapshots} from '../harness.mjs'
import {creditAccountFixture,creditInvoice,creditInput} from './refunds-journey.mjs'
export const grantInput=(operatorId,role,version=0,limits={})=>({operatorId,role,version,location:'shop',discountBps:500,spendCents:1000,refundCents:200,costRight:false,confirm:'grant-staff',reason:'Owner reviewed the staff responsibility',...limits})
export async function auditJourney(h){
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
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
 try{await restore(fresh,backup);const recovered=(await fresh.api('/api/mallet/audit')).entries;for(const entry of original)assert.deepEqual(recovered.find(x=>x.id===entry.id),entry);await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
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
 const po={reference:'synthetic-mallet-po',supplier:'Synthetic supplier',shipTo:'Shop',expectedAt:'2026-11-05T09:00:00Z',taxCents:0,freightCents:0,lines:[{itemId:item.id,quantity:1,unitCents:1001}]}
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
 const current=(await h.state()).records,backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);assert.equal(await (await fresh.mf.getD1Database('DB')).prepare('SELECT count(*) AS n FROM mallet_location_staff_grants').first('n'),0);assert.ok((await fresh.api('/api/mallet/audit?action=staff.grant')).entries.length>=5)}finally{await fresh.close()}
 await h.command('staff.revoke',grantInput(people.advisor.id,'advisor',grant.version))
 assert.equal((await h.request('/app/staff',{as:people.advisor.cookie})).status,403)
 await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines},{as:people.advisor.cookie,status:403})
 const grantAudit=(await h.api('/api/mallet/audit')).entries.filter(e=>['staff.grant','staff.revoke'].includes(e.action));assert.equal(grantAudit.length,9);for(const entry of grantAudit){assert.equal(entry.actor.id,(await h.state()).actor.id);assert.equal(entry.changes.length,1);assert.equal(entry.changes[0].kind,'staffGrant');assert.equal(entry.changes[0].afterRevision,(entry.changes[0].beforeRevision??0)+1)}
 await h.api('/auth/operator/status',{operatorId:people.purchaser.id,status:'inactive'});await h.api('/api/mallet/staff/state',undefined,{as:people.purchaser.cookie,status:401})
}
