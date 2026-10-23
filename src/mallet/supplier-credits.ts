import {event,fail,integer,put,rows,text,who,type Context,type Row,type State} from './model'
export function supplierCredits(s:State,sourceKind:string,sourceId:string){return rows(s,'stockSupplierCredit').filter(r=>r.sourceKind===sourceKind&&r.sourceId===sourceId)}
export function recordSupplierCredit(c:Context,sourceKind:string,source:Row,p:any){
 const reference=text(p.reference,'supplier credit reference'),amountCents=integer(p.amountCents,'supplier credit USD cents',0,100_000_000),evidence=text(p.evidence,'supplier credit evidence',4000),reason=text(p.reason,'credit reconciliation reason',2000)
 const request={sourceKind,sourceId:source.id,supplier:source.supplier,reference,amountCents,evidence,reason},prior=rows(c.s,'stockSupplierCredit').find(r=>r.supplier.toLowerCase()===source.supplier.toLowerCase()&&r.reference.toLowerCase()===reference.toLowerCase())
 if(prior){if(JSON.stringify(prior.request)!==JSON.stringify(request))fail('CREDIT_REPLAY','This supplier credit reference already has different facts.');return prior}
 const row=put(c.s,'stockSupplierCredit',{...request,request,by:who(c),at:c.now,label:'Staff-reconciled supplier document; not a payment or accounting posting.'})
 event(c,'stock.supplierCredit',source.jobId??null,row.id,{sourceKind,sourceId:source.id,amountCents});return row
}
