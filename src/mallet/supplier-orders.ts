import {bump,event,expectVersion,fail,find,put,rows,text,who,type Handler,type State,type Row} from './model'
import {amount} from './inventory'
import {purchasing} from './purchasing'
export const supplierOrderCommands=['purchase.retainComparison','purchase.cart','purchase.claimOrder','purchase.claimAction','purchase.orderOutcome']
export const internalSupplierCommands=['purchase.retainComparison','purchase.claimOrder','purchase.claimAction','purchase.orderOutcome']
export function supplierSubmission(s:State,poId:string){return rows(s,'purchaseSubmission').find(r=>r.purchaseId===poId)}
export function assertSupplierCart(s:State,po:Row,now:string){
 if(!po.supplierQuote)return
 const quote=po.supplierQuote
 if(!quote.compatible||quote.availableMilli<po.lines[0].quantityMilli||quote.expiresAt<=now||quote.cutoffAt<=now)fail('SUPPLIER_QUOTE_STALE','This quote is incompatible, unavailable or past its expiry/cutoff. Compare suppliers again before approval or submission.')
 if(po.totalCents!==quote.totalCents||po.supplier!==quote.supplierName||po.lines[0].unitCents!==quote.unitCents)fail('SUPPLIER_CART_CHANGED','The exact supplier quote and approved cart must agree.')
}
export function supplierOrderReport(s:State):{comparisons:Row[];orders:Row[]}{return {comparisons:rows(s,'purchaseComparison'),orders:rows(s,'purchaseOrder').filter(p=>p.supplierQuote).map(po=>({...po,submission:supplierSubmission(s,po.id)??null}))}}
export const supplierOrders:Handler=(c,command,p)=>{
 if(!supplierOrderCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only owner and admin operators manage supplier orders.',null,403)
 if(command==='purchase.retainComparison'){
  const item=find(c.s,'stockItem',p.itemId),quantityMilli=amount(p.quantity),jobId=p.jobId?find(c.s,'job',p.jobId).id:null
  if(jobId&&!['booked','working'].includes(find(c.s,'job',jobId).status))fail('JOB_STATE','Source parts only for an open repair.')
  const row=put(c.s,'purchaseComparison',{itemId:item.id,sku:item.sku,unit:item.unit,quantityMilli,jobId,origin:p.origin,offers:p.offers,observedAt:c.now,by:who(c),at:c.now});event(c,command,jobId,row.id,{offerCount:row.offers.length});return row
 }
 if(command==='purchase.cart'){
  const comparison=find(c.s,'purchaseComparison',p.comparisonId),offer=comparison.offers.find((o:any)=>o.quoteId===p.quoteId)
  if(!offer)fail('SUPPLIER_QUOTE','Choose a supplier quote from this comparison.')
  if(rows(c.s,'purchaseOrder').some(po=>po.comparisonId===comparison.id))fail('DUPLICATE','This comparison already has a cart; review its existing order.')
  const po=purchasing(c,'purchase.create',{reference:text(p.reference,'PO reference'),supplier:offer.supplierName,shipTo:p.shipTo,expectedAt:offer.etaAt,taxCents:offer.taxCents,freightCents:offer.freightCents,binId:p.binId,lines:[{itemId:comparison.itemId,quantity:comparison.quantityMilli/1000,unitCents:offer.unitCents,jobId:comparison.jobId}]})
  po.comparisonId=comparison.id;po.supplierOrigin=comparison.origin;po.supplierQuote={...offer,quantityMilli:comparison.quantityMilli,sku:comparison.sku,unit:comparison.unit}
  assertSupplierCart(c.s,po,c.now);return po
 }
 const po=find(c.s,'purchaseOrder',p.purchaseId)
 if(command==='purchase.claimOrder'){
  if(p.confirm!=='submit-exact-cart')fail('SUPPLIER_APPROVAL','Explicitly confirm submission of this exact approved supplier cart.')
  const prior=supplierSubmission(c.s,po.id);if(prior)return prior
  expectVersion(po,p.version)
  if(!po.approval||!po.supplierQuote||po.closed||po.shortClose)fail('SUPPLIER_APPROVAL','Approve the exact supplier/cart/amount before one submission.')
  assertSupplierCart(c.s,po,c.now)
  const row=put(c.s,'purchaseSubmission',{purchaseId:po.id,claimNonce:p.claimNonce,jobId:po.lines[0].jobId,status:'claimed',clientReference:po.id,origin:po.supplierOrigin,approval:structuredClone(po.approval),cart:{supplierId:po.supplierQuote.supplierId,quoteId:po.supplierQuote.quoteId,currency:'USD',totalCents:po.totalCents,shipTo:po.shipTo,lines:[{sku:po.supplierQuote.sku,grade:po.supplierQuote.grade,unit:po.supplierQuote.unit,quantityMilli:po.lines[0].quantityMilli,unitCents:po.lines[0].unitCents}]},orderId:null,history:[],actions:[],by:who(c),at:c.now})
  event(c,command,row.jobId,row.id,{purchaseId:po.id,totalCents:po.totalCents});return row
 }
 const submission=supplierSubmission(c.s,po.id)
 if(!submission)fail('SUPPLIER_STATE','Submit an approved cart before supplier reconciliation.')
 expectVersion(submission,p.submissionVersion)
 if(command==='purchase.claimAction'){
  const action=p.action
  if(!['cancel','reject-substitution'].includes(action)||p.confirm!==action)fail('SUPPLIER_APPROVAL','Explicitly approve cancellation or rejection of the exact supplier substitution.')
  const prior=submission.actions.find((a:any)=>a.action===action&&a.proposalId===(p.proposalId??null))
  if(prior)return submission
  if(!submission.orderId||action==='reject-substitution'&&(submission.status!=='substitution'||submission.history.at(-1)?.proposal?.id!==p.proposalId)||action==='cancel'&&['cancelled','rejected'].includes(submission.status))fail('SUPPLIER_STATE','The current supplier outcome does not permit this action.')
  const intent={id:crypto.randomUUID(),claimNonce:p.claimNonce,action,proposalId:p.proposalId??null,reason:text(p.reason,'supplier action reason',2000),by:who(c),at:c.now}
  const saved=bump(c.s,'purchaseSubmission',submission,{actions:[...submission.actions,intent]});event(c,command,submission.jobId,submission.id,intent);return saved
 }
 const outcome=p.outcome
 if(['cancelled','rejected'].includes(submission.status)){if(outcome.status==='uncertain')return submission;if(outcome.status!==submission.status)fail('SUPPLIER_FINAL','A terminal supplier outcome cannot be replaced by an older observation.')}

 if(outcome.orderId&&submission.orderId&&outcome.orderId!==submission.orderId)fail('SUPPLIER_ORDER_CONFLICT','The supplier returned another order for the same client reference; reconcile the exception without another submission.')
 const history={...outcome,at:c.now,by:who(c)}
 if(JSON.stringify(submission.history.at(-1)?.receipt)===JSON.stringify(outcome.receipt)&&submission.status===outcome.status)return submission
 const saved=bump(c.s,'purchaseSubmission',submission,{status:outcome.status,orderId:outcome.orderId??submission.orderId,history:[...submission.history,history]});event(c,command,submission.jobId,submission.id,{status:outcome.status,orderId:saved.orderId});return saved
}
