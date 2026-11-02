import {area,box,e,field,form,money,rows,select,when} from './common'
import {supplierOrderReport} from '../supplier-orders'
export function supplierOrdersPage(s:any){
 const report=supplierOrderReport(s),items=rows(s,'stockItem'),jobs=rows(s,'job').filter(j=>['booked','working'].includes(j.status))
 let body='<p><a href="/app/purchasing">Purchase orders & goods receipts</a> · <a href="/app/inventory">Stock & receiving</a> · <a href="/app/connectors">Connection declarations & keys</a></p><p>Compare current supplier quotes, then review one exact supplier, grade, cart and amount before approving spend and explicitly submitting. A suggestion is not placed; an uncertain send is reconciled by client reference, never submitted again. Direct supplier licensing remains with its named connector.</p>'
 if(items.length)body+=box('Compare suppliers',form('purchase.compare',select('Catalog part','itemId',items.map(i=>[i.id,i.sku+' · '+i.name]))+field('Required quantity','quantity','number',1,'required min="0.001" step="0.001"')+select('Repair demand','jobId',[['','Stock need'],...jobs.map(j=>[j.id,j.title] as [string,string])]),'Compare current availability',{returnTo:'suppliers'}))
 for(const comparison of report.comparisons){
 let content=`<p>${e(comparison.sku)} · ${comparison.quantityMilli/1000} ${e(comparison.unit)} · Observed ${when(comparison.observedAt)}</p><ul>`+comparison.offers.map((q:any)=>`<li><strong>${e(q.supplierName)} · ${e(q.grade)}</strong><p>${q.compatible?'Compatible':'Incompatible'} · Available ${q.availableMilli/1000} · Unit ${money(q.unitCents)} · Freight ${money(q.freightCents)} · Tax ${money(q.taxCents)} · Total ${money(q.totalCents)}<br>Delivery cutoff ${when(q.cutoffAt)} · ETA ${when(q.etaAt)} · Quote expires ${when(q.expiresAt)} · Supplier observed ${when(q.observedAt)}</p></li>`).join('')+'</ul>'
 if(!report.orders.some(po=>po.comparisonId===comparison.id))content+=form('purchase.cart',select('Exact supplier quote','quoteId',comparison.offers.map((q:any)=>[q.quoteId,q.supplierName+' · '+q.grade+' · '+money(q.totalCents)]))+field('Unique PO reference','reference','text','','required')+area('Ship-to address','shipTo','','required')+select('Stock destination bin (optional)','binId',[['','Unlocated / repair demand'],...rows(s,'stockBin').map(b=>[b.id,b.code] as [string,string])]),'Prepare exact supplier cart',{comparisonId:comparison.id,returnTo:'suppliers'})
 body+=box('Supplier comparison',content)
 }
 for(const po of report.orders){
 const refs={purchaseId:po.id,version:po.version,returnTo:'suppliers'},submission=po.submission
 let content=`<p>${e(po.supplier)} · ${e(po.supplierQuote.grade)} · ${po.lines[0].quantityMilli/1000} ${e(po.lines[0].unit)}<br>Exact cart total ${money(po.totalCents)} · Ship to ${e(po.shipTo)} · ETA ${when(po.expectedAt)}<br>${po.lines[0].jobId?`<a href="/app/jobs/${e(po.lines[0].jobId)}">Linked repair demand</a>`:'Stock demand'}</p>`
 if(!po.approval)content+=form('purchase.approve',area('Spend approval reason','reason','','required'),'Approve exact supplier cart',refs)
 else content+=`<p>Approved ${money(po.approval.totalCents)} · ${e(po.approval.supplier)} · ${e(po.approval.by.name)} · ${e(po.approval.reason)}</p>`
 if(po.approval&&!submission)content+=form('purchase.submit','<p>This explicitly sends the exact approved cart and ship-to address once to the configured supplier gateway.</p>','Submit approved cart once',{...refs,confirm:'submit-exact-cart'})
 if(submission){
 content+=`<p><strong>Supplier outcome: ${e(submission.status)}</strong><br>${submission.orderId?'Supplier order '+e(submission.orderId):'No acknowledged supplier order yet'} · Client reference ${e(submission.clientReference)}</p>`+form('purchase.reconcile','','Reconcile existing supplier order',{...refs,submissionVersion:submission.version})
 const proposal=submission.history.at(-1)?.proposal
 if(submission.status==='substitution'&&proposal)content+=box('Proposed substitution',`<p>${e(proposal.sku)} · ${e(proposal.grade)} · ${money(proposal.unitCents)}. This has not changed or approved your original cart.</p>`+form('purchase.rejectSubstitution',area('Substitution rejection reason','reason','','required'),'Reject supplier substitution',{...refs,submissionVersion:submission.version,proposalId:proposal.id,confirm:'reject-substitution'}))
 if(!['cancelled','rejected'].includes(submission.status))content+=`<details><summary>Request supplier cancellation</summary>${form('purchase.cancel',area('Cancellation reason','reason','','required'),'Confirm supplier cancellation request',{...refs,submissionVersion:submission.version,confirm:'cancel'})}</details>`
 content+='<ul>'+submission.history.map((h:any)=>`<li>${e(h.status)} · ${e(h.receipt?.reason??h.receipt?.label??'Matched supplier response')} · ${when(h.at)}</li>`).join('')+'</ul>'
 if(submission.actions.length)content+='<ul>'+submission.actions.map((a:any)=>`<li>Explicit ${e(a.action)} · ${e(a.reason)} · ${e(a.by.name)} · ${when(a.at)}</li>`).join('')+'</ul>'
 }
 body+=box(po.reference,content)
 }
 return '<div class="narrow">'+body+'</div>'
}
export function supplierOrdersFormInput(p:any){if(['purchase.compare','purchase.cart','purchase.submit','purchase.reconcile','purchase.rejectSubstitution','purchase.cancel'].includes(p.command))for(const key of ['quantity','version','submissionVersion'])if(key in p)p[key]=Number(p[key])}
