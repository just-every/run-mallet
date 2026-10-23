import assert from 'node:assert/strict'
import {booking,archive,restore,installation} from '../harness.mjs'
import {inventoryFixture} from './inventory-journey.mjs'
import {supplierEdge} from './supplier-edge.mjs'
export async function supplierFixture(h){const f=await inventoryFixture(h),{job}=await booking(h);return {...f,job,compare:{itemId:f.item.id,quantity:1,jobId:job.id}}}
export async function supplierJourney(){
 const edge=supplierEdge(),h=await installation({bindings:{MALLET_SUPPLIER_ORIGIN:edge.origin,MALLET_SUPPLIER_KEY:edge.key},outboundService:edge.fetch})
 try{
 const f=await supplierFixture(h),member=await h.person('buyer-tech@example.test'),admin=await h.person('buyer-advisor@example.test','admin'),agentKey=await h.command('agent.create',{label:'No supplier submission authority'}),agent={as:'',headers:{authorization:'Bearer '+agentKey.token}},baseline=edge.calls.length
 for(const command of ['purchase.compare','purchase.cart','purchase.submit','purchase.reconcile','purchase.cancel','purchase.rejectSubstitution'])for(const opts of [{as:'',status:401},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,f.compare,opts)
 for(const command of ['purchase.retainComparison','purchase.claimOrder','purchase.claimAction','purchase.orderOutcome'])await h.command(command,{}, {status:404})
 assert.equal(edge.calls.length,baseline,'Unauthorized and forged internal commands never reach the supplier')
 const comparison=await h.command('purchase.compare',f.compare);assert.equal(comparison.offers.length,2);assert.deepEqual(comparison.offers.map(q=>[q.supplierName,q.grade,q.unitCents,q.freightCents,q.totalCents]),[['Cedar Parts','OE-equivalent',1000,200,1300],['Maple Parts','Remanufactured',900,500,1490]])
 assert.deepEqual(Object.keys(edge.calls.at(-1).query).sort(),['quantity_milli','sku','unit']);assert.equal(edge.calls.at(-1).query.sku,f.item.sku)
 let po=await h.command('purchase.cart',{comparisonId:comparison.id,quoteId:comparison.offers[0].quoteId,reference:'synthetic-mallet-230',shipTo:'Receiving bench, 17 Cedar Rd',binId:f.bin.id}),refs=()=>({purchaseId:po.id,version:po.version})
 assert.equal(po.totalCents,1300);assert.equal(po.lines[0].jobId,f.job.id)
 await h.command('purchase.submit',{...refs(),confirm:'submit-exact-cart'},{status:409})
 po=await h.command('purchase.approve',{...refs(),reason:'Approve Cedar exact SKU, grade, supplier and $13 cart'},{as:admin.cookie});assert.equal(po.approval.supplier,'Cedar Parts');assert.deepEqual(po.approval.supplierQuote,po.supplierQuote)
 let submission=await h.command('purchase.submit',{...refs(),confirm:'submit-exact-cart'});assert.equal(submission.status,'uncertain');assert.equal(edge.orders.size,1)
 const posts=()=>edge.calls.filter(c=>c.method==='POST'&&c.path==='/v1/orders')
 assert.equal(posts().length,1);assert.equal(posts()[0].body.totalCents,po.approval.totalCents);assert.deepEqual(posts()[0].body.lines,[{sku:f.item.sku,grade:'OE-equivalent',unit:'each',quantityMilli:1000,unitCents:1000}]);assert.equal(posts()[0].body.shipTo,po.shipTo);assert.ok(!JSON.stringify(posts()[0].body).includes(f.job.asset.customerEmail))
 submission=await h.command('purchase.submit',{...refs(),confirm:'submit-exact-cart'});assert.equal(submission.status,'acknowledged');assert.equal(posts().length,1,'Timed-out POST replay is a client-reference lookup, never another order')
 edge.substitute(po.id);submission=await h.command('purchase.reconcile',refs());assert.equal(submission.status,'substitution');assert.equal(submission.history.at(-1).proposal.unitCents,5000)
 await h.command('purchase.receive',{...refs(),lineId:po.lines[0].id,...f.scans,quantity:1,reference:'synthetic-mallet-231'},{status:409})
 const reject={...refs(),submissionVersion:submission.version,proposalId:submission.history.at(-1).proposal.id,confirm:'reject-substitution',reason:'Reject higher-cost incompatible replacement; keep exact original cart'}
 submission=await h.command('purchase.rejectSubstitution',reject);assert.equal(submission.status,'acknowledged');assert.equal(submission.actions.length,1);assert.equal(submission.history.at(-1).receipt.actionId,submission.actions[0].id)
 submission=await h.command('purchase.rejectSubstitution',reject);assert.equal(edge.actions.size,1);assert.equal(posts().length,1);assert.equal(edge.orders.size,1)
 assert.deepEqual((await h.state()).records.purchaseOrder.find(p=>p.id===po.id).approval,po.approval)
 const report=await h.api('/api/mallet/supplier-orders');assert.equal(report.orders[0].submission.orderId,submission.orderId);assert.equal(report.orders[0].lines[0].jobId,f.job.id)
 edge.mode='mismatch';submission=await h.command('purchase.reconcile',refs());assert.equal(submission.status,'uncertain')
 edge.mode='secret-echo';submission=await h.command('purchase.reconcile',refs());assert.equal(submission.status,'uncertain');assert.ok(!JSON.stringify((await h.state()).records).includes(edge.key));assert.ok(!h.logs.join('\n').includes(edge.key))
 edge.mode='normal';submission=await h.command('purchase.reconcile',refs());assert.equal(submission.status,'acknowledged')
 const final=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'supplier-recovery@example.test',MALLET_SUPPLIER_ORIGIN:edge.origin,MALLET_SUPPLIER_KEY:edge.key},outboundService:edge.fetch})
 try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,final);await fresh.command('purchase.submit',{...refs(),confirm:'submit-exact-cart'});assert.equal(posts().length,1,'Recovered claims remain GET-only')}finally{await fresh.close()}
 const cancel={...refs(),submissionVersion:submission.version,confirm:'cancel',reason:'Customer changed repair scope; explicitly request supplier cancellation'}
 submission=await h.command('purchase.cancel',cancel);assert.equal(submission.status,'cancelled');await h.command('purchase.cancel',cancel);assert.equal(edge.actions.size,2)
 await h.command('purchase.receive',{...refs(),lineId:po.lines[0].id,...f.scans,quantity:1,reference:'synthetic-mallet-231'},{status:409})
 edge.mode='reject';const secondComparison=await h.command('purchase.compare',f.compare)
 let rejected=await h.command('purchase.cart',{comparisonId:secondComparison.id,quoteId:secondComparison.offers[1].quoteId,reference:'synthetic-mallet-232',shipTo:'Receiving bench'});rejected=await h.command('purchase.approve',{purchaseId:rejected.id,version:rejected.version,reason:'Explicit second reviewed supplier cart after first cancellation'})
 const rejection=await h.command('purchase.submit',{purchaseId:rejected.id,version:rejected.version,confirm:'submit-exact-cart'});assert.equal(rejection.status,'rejected');await h.command('purchase.submit',{purchaseId:rejected.id,version:rejected.version,confirm:'submit-exact-cart'});assert.equal(posts().length,2,'Rejected orders are not resubmitted')
 for(const mode of ['expired','incompatible','short']){edge.quoteMode=mode;const compare=await h.command('purchase.compare',f.compare);await h.command('purchase.cart',{comparisonId:compare.id,quoteId:compare.offers[0].quoteId,reference:'synthetic-mallet-'+({expired:233,incompatible:234,short:235}[mode]),shipTo:'Receiving bench'},{status:409})}
 await h.command('connector.revoke',{connector:'supplier-gateway',name:'MALLET_SUPPLIER_KEY'});const before=edge.calls.length
 await h.command('purchase.compare',f.compare,{status:503});assert.equal(edge.calls.length,before,'Revoked keys prevent new network requests')
 await h.api('/api/mallet/supplier-orders',undefined,{as:member.cookie,status:403});assert.equal((await h.state({as:member.cookie})).records.purchaseSubmission,undefined)
 }finally{await h.close()}
}
