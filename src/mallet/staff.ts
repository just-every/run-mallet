import {HttpError,type Actor,type Authority} from './auth'
import {execute,load,type State} from './model'
import {invoiceBalance} from './payments'
import {stockBalance} from './inventory'
import {purchaseInShop} from './purchasing'
import {e,field,select,form,box,rows,money} from './ui/common'
import {purchasingPage} from './ui/purchasing'
import {staffFinance,staffFinancePage,staffRefundForms,staffPayroll,staffPayrollPage} from './staff-finance'
import {staffIntakeForms} from './ui/staff-intake'
export type StaffGrant={revision:number;role:'advisor'|'manager'|'purchaser'|'cashier'|'accountant';location:string;discount_bps:number;spend_cents:number;refund_cents:number;collection_cents:number;cost_right:number;payroll_right:number}
export async function staffGrant(db:D1Database,id:string) {
 return db.prepare(`SELECT g.* FROM mallet_staff_grants g JOIN oa_operators o ON o.id=g.operator_id JOIN oa_operators owner ON owner.id=g.granted_by WHERE g.operator_id=? AND g.revoked_at IS NULL AND o.status='active' AND o.role='member' AND o.version=g.operator_version AND owner.status='active' AND owner.role='owner' AND owner.version=g.owner_version`).bind(id).first<StaffGrant>()
}
export function staffRoute(request:Request,actor:Actor) {
 if(!actor.staff)return
 const path=new URL(request.url).pathname
 if(!actor.staff.discount_bps&&!actor.staff.spend_cents&&!actor.staff.refund_cents&&!actor.staff.collection_cents&&path!=='/app/security'&&!path.startsWith('/api/mallet/security/')&&!path.startsWith('/auth/'))throw new HttpError(403,'staff_limits_required')
 if(path==='/app'&&['GET','HEAD'].includes(request.method))return
 if(['/app/staff','/api/mallet/staff/state','/api/mallet/staff/finance','/api/mallet/staff/payroll'].includes(path)&&['GET','HEAD'].includes(request.method))return
 if(['/app/actions','/api/mallet/commands'].includes(path)&&request.method==='POST')return
 // The person's own authentication door stays available; its existing owner-only gates still apply.
 if(path==='/app/security'||path.startsWith('/api/mallet/security/')||path.startsWith('/auth/'))return
 throw new HttpError(403,'staff_scope','Use your delegated staff workspace. This door is outside your grant.')
}
export function staffAuthority(actor:Actor,authority:Authority):Authority {
 if(!actor.staff)return authority
 return {sql:`(${authority.sql}) AND EXISTS(SELECT 1 FROM mallet_staff_grants g JOIN oa_operators o ON o.id=g.operator_id JOIN oa_operators owner ON owner.id=g.granted_by WHERE g.operator_id=? AND g.revision=? AND g.revoked_at IS NULL AND o.status='active' AND o.role='member' AND o.version=g.operator_version AND owner.status='active' AND owner.role='owner' AND owner.version=g.owner_version)`,params:[...authority.params,actor.id,actor.staff.revision]}
}
const advisor=['asset.create','job.book','estimate.prepare','estimate.revise','estimate.approve','estimate.markSent','estimate.authorise'],purchaser=['stock.item','stock.bin','stock.receive','stock.count','stock.approveCount','purchase.create','purchase.approve','purchase.receive','purchase.bill','purchase.shortClose','purchase.close'],finance=['payment.record','credit.preview','credit.issue','refund.record']
export async function staffCommand(db:D1Database,actor:Actor,authority:Authority,command:string,input:any) {
 const grant=actor.staff!;if(!grant.discount_bps&&!grant.spend_cents&&!grant.refund_cents&&!grant.collection_cents)throw new HttpError(403,'staff_limits_required');const allowed=grant.role==='manager'?[...advisor,...purchaser,...finance]:grant.role==='advisor'?[...advisor,'credit.preview','credit.issue','refund.record']:grant.role==='purchaser'?purchaser:grant.role==='cashier'?finance:[]
 if(!allowed.includes(command))throw new HttpError(403,'staff_command_denied')
 if(command.startsWith('purchase.')&&!grant.cost_right)throw new HttpError(403,'staff_cost_right_required')
 if(input.location!==undefined&&input.location!=='shop'||input.locationId!==undefined&&input.locationId!=='shop')throw new HttpError(403,'staff_location_denied')
 if(command.startsWith('estimate.'))for(const line of input.lines??[]){
  if(line.matrixId||line.override||line.costCents!==undefined||input.overrides)throw new HttpError(403,'staff_price_override_denied')
  if(!Number.isSafeInteger(line.unitCents)||!Number.isSafeInteger(line.unitDiscountCents??0)||(line.unitDiscountCents??0)*10000>line.unitCents*grant.discount_bps)throw new HttpError(403,'staff_discount_limit')
 }
 // Limits are evaluated inside the same optimistic state transaction as the business action.
 return redact(await execute(db,{...actor,role:'admin',staffRole:grant.role} as any,command,input,authority,undefined,{spendCents:grant.spend_cents,refundCents:grant.refund_cents,collectionCents:grant.collection_cents,discountBps:grant.discount_bps}),!!grant.cost_right)
}
const number=(v:any,max=1000000000)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>max)throw new HttpError(400,'invalid_staff_limit');return n}
export async function grantStaff(db:D1Database,actor:Actor,authority:Authority,command:string,input:any) {
 if(actor.role!=='owner')throw new HttpError(403,'owner_required')
 const target=await db.prepare("SELECT id,version FROM oa_operators WHERE id=? AND role='member' AND status='active'").bind(String(input.operatorId??'')).first<{id:string;version:number}>()
 if(!target)throw new HttpError(400,'active_member_required')
 const previous=await db.prepare('SELECT * FROM mallet_staff_grants WHERE operator_id=?').bind(target.id).first<any>(),revision=number(input.version)
 if(revision!==(previous?.revision??0))throw new HttpError(409,'staff_grant_changed')
 if(input.confirm!=='grant-staff'||!String(input.reason??'').trim())throw new HttpError(400,'staff_consent_required')
 const role=String(input.role??previous?.role??'');if(!['advisor','manager','purchaser','cashier','accountant'].includes(role))throw new HttpError(400,'invalid_staff_role')
 if(input.location!=='shop')throw new HttpError(403,'staff_location_denied')
 const discount=number(input.discountBps??0,10000),spend=number(input.spendCents??0),refund=number(input.refundCents??0),collection=number(input.collectionCents??0),payroll=input.payrollRight===true||input.payrollRight==='yes'?1:0,cost=input.costRight===true||input.costRight==='yes'?1:0,id=crypto.randomUUID(),at=new Date().toISOString(),revoked=command==='staff.revoke'?Date.now():null
 const snapshot={role,location:'shop',discountBps:discount,spendCents:spend,refundCents:refund,collectionCents:collection,costRight:!!cost,payrollRight:!!payroll,revoked:revoked!==null}
 const audit={id,version:1,action:command,at,actor:{id:actor.id,name:actor.name,role:actor.role},policy:'owner-delegation-v1',changes:[{kind:'staffGrant',id:target.id,beforeRevision:previous?.revision??null,afterRevision:revision+1}],evidence:[snapshot]}
 await db.batch([
  db.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND role='member' AND status='active') AND COALESCE((SELECT revision FROM mallet_staff_grants WHERE operator_id=?),0)=? THEN 1 ELSE 0 END`).bind(...authority.params,target.id,target.version,target.id,revision),
  db.prepare(`INSERT INTO mallet_staff_grants(operator_id,operator_version,revision,role,location,discount_bps,spend_cents,refund_cents,collection_cents,cost_right,payroll_right,granted_by,owner_version,revoked_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,id,version,? FROM oa_operators WHERE id=? AND role='owner' AND status='active' ON CONFLICT(operator_id) DO UPDATE SET operator_version=excluded.operator_version,revision=excluded.revision,role=excluded.role,location=excluded.location,discount_bps=excluded.discount_bps,spend_cents=excluded.spend_cents,refund_cents=excluded.refund_cents,collection_cents=excluded.collection_cents,cost_right=excluded.cost_right,payroll_right=excluded.payroll_right,granted_by=excluded.granted_by,owner_version=excluded.owner_version,revoked_at=excluded.revoked_at`).bind(target.id,target.version,revision+1,role,'shop',discount,spend,refund,collection,cost,payroll,revoked,actor.id),
  db.prepare("INSERT INTO mallet_records(kind,id,revision,value) VALUES('audit',?,1,?)").bind(id,JSON.stringify(audit)),db.prepare('DELETE FROM mallet_assert')])
 return {operatorId:target.id,version:revision+1,...snapshot}
}
export async function staffSettings(db:D1Database) {
 const people=(await db.prepare("SELECT o.id,o.display_name AS name,g.* FROM oa_operators o LEFT JOIN mallet_staff_grants g ON g.operator_id=o.id WHERE o.role='member' AND o.status='active' ORDER BY o.display_name").all<any>()).results
 return box('Owner-controlled delegation','<p>Grants apply to this installation’s shop only. Limits start at zero. Native staff can prepare and approve within their saved limits; supplier submission and destructive actions stay with the owner. Grants never restore from a backup.</p>')+people.map(p=>box(p.name,form('staff.grant',select('Staff role','role',['advisor','manager','purchaser','cashier','accountant'].map(r=>[r,r]),p.role??'advisor')+field('Location','location','text','shop','required readonly')+field('Discount limit (%)','discountPercent','number',(p.discount_bps??0)/100,'required min="0" max="100" step="0.01"')+field('Spend limit (USD)','spendUsd','number',(p.spend_cents??0)/100,'required min="0" step="0.01"')+field('Collection limit per tender (USD)','collectionUsd','number',(p.collection_cents??0)/100,'required min="0" step="0.01"')+field('Refund limit (USD)','refundUsd','number',(p.refund_cents??0)/100,'required min="0" step="0.01"')+`<label class="check"><input type="checkbox" name="costRight" value="yes"${p.cost_right?' checked':''}> Separate cost viewing right</label><label class="check"><input type="checkbox" name="payrollRight" value="yes"${p.payroll_right?' checked':''}> Separate payroll viewing right</label>`+field('Delegation reason','reason','text','','required')+'<label class="check"><input type="checkbox" name="confirm" value="grant-staff" required> I approve these exact rights and limits.</label>','Save staff grant',{operatorId:p.id,version:p.revision??0})+(p.revision?form('staff.revoke',field('Revocation reason','reason','text','','required')+'<label class="check"><input type="checkbox" name="confirm" value="grant-staff" required> Revoke delegated access</label>','Revoke staff grant',{operatorId:p.id,version:p.revision,role:p.role,location:'shop'}):''))).join('')
}
function redact(value:any,cost=false):any {
 if(Array.isArray(value))return value.map(x=>redact(x,cost))
 if(!value||typeof value!=='object')return value
 return Object.fromEntries(Object.entries(value).filter(([key])=>!['billing','receipt','evidence','consentEvidence','raw','token','secret','payRate','pricingProvenance'].includes(key)&&(cost||!['costCents','unitCostCents','loadedCostCents'].includes(key))).map(([k,v])=>[k,redact(v,cost)]))
}
export function staffState(state:State,actor:Actor,people:{id:string;name:string}[]=[],params=new URLSearchParams()){
 const g=actor.staff!,records:Record<string,any[]>={}
 const bins=new Set(rows(state,'stockBin').filter(b=>(b.location??b.locationId??'shop')==='shop').map(b=>b.id)),purchases=new Set(rows(state,'purchaseOrder').filter(po=>purchaseInShop(state,po)).map(po=>po.id))
 const inShop=(kind:string,r:any):boolean=>{
  if(!r||(r.location??r.locationId??'shop')!=='shop')return false
  if(kind==='job')return true
  if(r.jobId&&!inShop('job',rows(state,'job').find(j=>j.id===r.jobId)))return false
  return kind==='invoice'||!r.invoiceId||inShop('invoice',rows(state,'invoice').find(i=>i.id===r.invoiceId))
 }
 const permitted=(kind:string,r:any)=>inShop(kind,r)&&(!['stockCount','stockMovement','stockReservation','purchaseReceipt'].includes(kind)||bins.has(r.binId))&&(kind!=='purchaseOrder'||purchases.has(r.id))&&(!['purchaseBill','purchaseReceipt'].includes(kind)||purchases.has(r.purchaseId))
 const kinds=g.role==='accountant'||g.role==='cashier'?['invoice','payment','creditNote','refund']:g.role==='purchaser'?['stockItem','stockBin','stockCount','stockMovement','stockReservation','purchaseOrder','purchaseReceipt','purchaseBill']:['asset','job','estimate',...(g.role==='manager'?['stockItem','stockBin','stockCount','stockMovement','stockReservation','purchaseOrder','purchaseReceipt','purchaseBill','invoice','payment','creditNote','refund']:[])]
 for(const kind of kinds){if(['purchaseOrder','purchaseBill'].includes(kind)&&!g.cost_right)continue;records[kind]=rows(state,kind).filter(r=>permitted(kind,r)).map(r=>redact(r,!!g.cost_right))}
 // Purchasing demand needs only the open repair's identity and title, never customer or diagnostic payloads.
 if(g.role==='purchaser'&&g.cost_right)records.job=rows(state,'job').filter(j=>(j.location??j.locationId??'shop')==='shop'&&['booked','working'].includes(j.status)).map(j=>({id:j.id,title:j.title,status:j.status,version:j.version}))
 const financeState={version:state.version,records:{...records,stripeReturn:rows(state,'stripeReturn').filter(r=>permitted('payment',rows(state,'payment').find(p=>p.id===r.paymentId)))}} as State
 const finance=['accountant','cashier','manager'].includes(g.role)?staffFinance(financeState):undefined
 return {actor:{id:actor.id,name:actor.name,role:g.role},location:'shop',technicians:['advisor','manager'].includes(g.role)?people:[],limits:{discountBps:g.discount_bps,spendCents:g.spend_cents,refundCents:g.refund_cents,collectionCents:g.collection_cents,costRight:!!g.cost_right,payrollRight:!!g.payroll_right},records,finance,payroll:g.payroll_right&&['accountant','manager'].includes(g.role)?staffPayroll(state,params):undefined,stockBalances:['purchaser','manager'].includes(g.role)?(records.stockItem??[]).flatMap(item=>(records.stockBin??[]).map(bin=>({...stockBalance({records} as State,item.id,bin.id),item:item.name,bin:bin.code}))):[],balances:['accountant','cashier','manager'].includes(g.role)?(records.invoice??[]).filter(i=>i.status!=='draft').map(i=>({invoiceId:i.id,number:i.number,...redact(invoiceBalance(financeState,i))})):[]}
}
export function staffPage(view:ReturnType<typeof staffState>) {
 const download='<p><a href="/api/mallet/staff/state?download=1">Download permitted records</a></p>',g=view.limits
 const names:Record<string,string>={asset:'Customer asset',job:'Repair order',estimate:'Estimate',stockItem:'Stock part',stockBin:'Stock bin',stockCount:'Stock count',stockMovement:'Stock movement',purchaseOrder:'Purchase order',purchaseReceipt:'Goods receipt',purchaseBill:'Supplier bill',stockReservation:'Stock reservation',invoice:'Invoice',payment:'Tender',creditNote:'Credit note',refund:'Refund'}
 const jobName=(id:string)=>(view.records.job??[]).find(j=>j.id===id)?.title??'Repair'
 const countName=(c:any)=>((view.records.stockItem??[]).find(i=>i.id===c.itemId)?.name??'Part')+' · '+((view.records.stockBin??[]).find(b=>b.id===c.binId)?.code??'Bin')+' · counted '+c.countedMilli/1000
 const title=(kind:string,r:any)=>kind==='stockCount'?countName(r):kind==='estimate'?jobName(r.jobId):r.title??r.number??r.name??r.label??r.code??names[kind]??'Record'
 const stock=['purchaser','manager'].includes(view.actor.role)?box('Stock correction',form('stock.count',field('Scanned item barcode','itemBarcode','text','','required')+field('Scanned bin barcode','binBarcode','text','','required')+field('Counted quantity','quantity','number',0,'required min="0" step="0.001"')+select('Count mode','mode',[['cycle','Cycle'],['blind','Blind']])+field('Count reason','reason','text','','required'),'Record stock count')+`<ul class="list">${(view.records.stockCount??[]).filter(c=>!c.approval).map(c=>`<li class="plain">${e(countName(c))}${form('stock.approveCount',field('Correction reason','reason','text','','required'),'Approve correction',{countId:c.id,version:c.version})}</li>`).join('')}</ul>`):''
 const purchasing=['purchaser','manager'].includes(view.actor.role)&&g.costRight&&g.spendCents>0?box('Purchasing',purchasingPage({records:view.records},{delegated:true})):''
 const stockBalances=view.stockBalances.length?box('Physical stock and reservations','<ul class="list">'+view.stockBalances.map(b=>`<li class="plain"><strong>${e(b.item)} · ${e(b.bin)}</strong><p>On hand ${e(b.onHandMilli/1000)} · Reserved ${e(b.reservedMilli/1000)} · Available ${e(b.availableMilli/1000)}</p></li>`).join('')+'</ul>'):''
 const estimates=['advisor','manager'].includes(view.actor.role)?box('Prepare an estimate',form('estimate.prepare',select('Repair order','staffJob',(view.records.job??[]).filter(j=>j.status==='booked').map(j=>[JSON.stringify({jobId:j.id,version:j.version}),j.title]))+field('Part description','partDescription','text','','required')+field('Part quantity','partQuantity','number',1,'required min="0.001" step="0.001"')+field('Part price in USD','partPrice','number',0,'required min="0" step="0.01"')+field('Part discount in USD','partDiscount','number',0,'min="0" step="0.01"')+field('Labor description','laborDescription','text','','required')+field('Labor quantity','laborQuantity','number',1,'required min="0.001" step="0.001"')+field('Labor price in USD','laborPrice','number',0,'required min="0" step="0.01"'),'Prepare estimate')):''
 const tender=['cashier','manager'].includes(view.actor.role)?box('Record staff tender',form('payment.record',select('Invoice','staffInvoice',(view.records.invoice??[]).filter(i=>['approved','exported'].includes(i.status)).map(i=>[JSON.stringify({invoiceId:i.id,version:i.version}),i.number]))+field('Amount (USD)','amountUsd','number',0,'required min="0.01" step="0.01"')+select('Tender method','method',[['cash','Cash'],['check','Check'],['other','Other']])+field('Tender reference','reference','text','','required')+field('Staff evidence','evidence','text','','required'),'Record tender')):''
 const approvals=['advisor','manager'].includes(view.actor.role)?box('Estimate handoff',`<ul class="list">${(view.records.estimate??[]).map(q=>{
  const rev=q.revisions.at(-1),exact={estimateId:q.id,version:q.version,revision:rev.n}
  const lines=rev.lines.map((l:any)=>`<li>${e(l.description)} · ${e(l.quantity)} · ${money(l.totalCents)}${g.costRight&&l.costCents!==undefined?' · Unit cost '+money(l.costCents):''}</li>`).join('')
  const approve=q.status==='draft'?form('estimate.approve','','Approve exact estimate',exact):''
  const share=q.status==='approved'?form('estimate.markSent','<p>Record your manual handoff of this exact approved price. Mallet sends no message and confirms no delivery.</p>'+select('Manual sharing method','channel',[['printed','Printed'],['phone','Phone'],['in person','In person'],['manual share','Manual share']])+field('Estimate handoff note','note'),'Record manual estimate handoff',exact):''
  const decision=q.status==='sent'?form('estimate.authorise','<p>Select only the lines the customer explicitly authorized. Unselected lines are declined.</p>'+rev.lines.map((l:any)=>`<label class="check"><input type="checkbox" name="lineIds" value="${e(l.id)}"> ${e(l.description)} · ${money(l.totalCents)}</label>`).join('')+field('Customer giving the decision','customerName','text','','required')+select('Recorded decision method','method',[['in person','In person'],['phone','Phone'],['email reply','Email reply'],['signed','Signed'],['other','Other']])+field('Exact customer instruction evidence','evidence','text','','required'),'Record exact customer decision',exact):''
  return `<li class="plain"><strong>${e(jobName(q.jobId))}</strong><p>Revision ${e(rev.n)} · ${money(rev.totals.totalCents)} · ${e(q.status)}</p><ul>${lines}</ul>${(q.sent??[]).map((r:any)=>`<p>Manual handoff · ${e(r.method)} · delivery not confirmed</p>`).join('')}${q.authorisation?'<p>Customer authorized '+e(q.authorisation.lineIds.length)+' exact lines.</p>':''}${approve}${share}${decision}</li>`
 }).join('')}</ul>`):''
 return box('Your delegated workspace',`<p>${e(view.actor.role)} · ${e(view.location)} · Discount ${g.discountBps/100}% · Spend ${money(g.spendCents)} · Collection ${money(g.collectionCents)} · Refund ${money(g.refundCents)}</p>${download}`)+(['advisor','manager'].includes(view.actor.role)?staffIntakeForms(view.records,view.technicians):'')+purchasing+stockBalances+stock+estimates+approvals+tender+(['cashier','manager'].includes(view.actor.role)?staffRefundForms(view.records):'')+(view.finance?staffFinancePage(view.finance):'')+(view.payroll?staffPayrollPage(view.payroll):'')+box('Permitted records',`<ul class="list">${Object.entries(view.records).flatMap(([kind,items])=>items.map(r=>`<li class="plain"><strong>${e(names[kind]??kind)} · ${e(title(kind,r))}</strong><p>${e(r.status??'')}${r.totals?' · '+money(r.totals.totalCents):''}${r.countedMilli!==undefined?' · Count '+e(r.countedMilli/1000):''}</p></li>`)).join('')}</ul>`)
}
