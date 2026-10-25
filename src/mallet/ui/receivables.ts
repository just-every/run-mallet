import {accountStatement,latestLedger} from '../receivables'
import {filingTax} from '../filing-tax'
import {fail} from '../model'
import {area,box,e,field,form,money,rows,select,when} from './common'
const evidence=()=>area('Account instruction and owner review evidence','evidence','','required maxlength="2000"')
function cents(input:any,fieldName:string,target:string){if(!/^\d+(?:\.\d{1,2})?$/.test(String(input[fieldName]??'')))fail('INPUT','Enter USD with at most two decimal places.',null,400);input[target]=Math.round(Number(input[fieldName])*100)}
export function receivablesInput(input:any){
 if(input.command==='ar.terms'){input.days=Number(input.days);cents(input,'limitUsd','limitCents');input.active=input.active==='yes';input.consent=input.consent==='yes'}
 if(input.command==='ar.promise')cents(input,'amountUsd','amountCents')
}
export function receivablesPage(s:any,accountId:string,asOf:string){
 const accounts=rows(s,'customerAccount').filter(a=>!a.mergedInto&&['fleet','business'].includes(a.kind)),account=accounts.find(a=>a.id===accountId)
 let body='<p><a href="/app/accounts?manage=all">Customer accounts</a> · <a href="/app/deposits">Deposits & customer credit</a></p><p>Owner-reviewed commercial terms and current account balances. No payment, reminder or handover authority is created here. Checks remain staff-recorded tender until clearance evidence is separately recorded.</p>'
 body+='<form method="get" action="/app/receivables">'+select('Commercial account','accountId',[['','Choose an account'],...accounts.map(a=>[a.id,a.name] as [string,string])],accountId)+field('Age balances at UTC date','asOf','date',asOf,'required')+'<button>Review statement</button></form>'
 if(!account)return '<div class="narrow">'+body+'</div>'
 const statement=accountStatement(s,account.id,asOf),terms=latestLedger(s,'arTerms',t=>t.accountId===account.id)
 body+=box('Commercial terms for '+account.name,(terms?`<p>Net ${e(terms.days)} days · limit ${money(terms.limitCents)} · ${terms.active?'Active':'Suspended'} · approved ${when(terms.at)}</p>`:'<p>No approved commercial terms.</p>')+form('ar.terms',field('Net days','days','number',terms?.days??30,'required min="1" max="365" step="1"')+field('Credit limit (USD)','limitUsd','number',(terms?.limitCents??100000)/100,'required min="0.01" step="0.01"')+`<label><input name="active" type="checkbox" value="yes"${!terms||terms.active?' checked':''}> Terms are active</label><label><input name="consent" type="checkbox" value="yes" required> Account explicitly consented to these terms</label>`+evidence(),'Save reviewed terms',{accountId:account.id,version:account.version}))
 body+=box('Current account statement',`<p>${e(statement.basis)}</p><p>Outstanding ${money(statement.outstandingCents)} USD</p><ul>${Object.entries(statement.ageing).map(([label,value])=>`<li>${e(label)}: ${money(value as number)}</li>`).join('')}</ul><p><a href="/api/mallet/receivables?${e(new URLSearchParams({accountId:account.id,asOf}).toString())}">Read statement JSON</a></p>`)
 for(const item of statement.invoices){const invoice=rows(s,'invoice').find(i=>i.id===item.invoiceId)!,values={invoiceId:invoice.id,version:invoice.version,accountId:account.id}
 let content=`<p><a href="/app/jobs/${e(item.jobId)}">${e(item.number)} · ${e(item.vehicle)}</a> · outstanding ${money(item.balance.outstandingCents)} · ${e(item.bucket)}</p><p>Invoice cost ${money(item.recordedCostCents)} · booked ${when(item.downtime.from)} · completed ${item.downtime.to?when(item.downtime.to):'not recorded'}. ${e(item.downtime.label)}</p><p>${item.chaseEligible?'Eligible outstanding balance for a consent-reviewed reminder':'Chasing paused or not due'}. No reminder sent.</p>`
 if(item.terms)content+=`<p>Due ${e(item.terms.dueOn)} · PO ${e(item.terms.po??'not required')} · ${e(item.terms.label)}</p>`
 else if(terms?.active)content+=form('ar.invoice',(account.kind==='fleet'?field('Fleet purchase order','po','text','','required')+select('Allowed fleet authorizer','authorizerId',account.authorizerId?[[account.authorizerId,rows(s,'contact').find(c=>c.id===account.authorizerId)?.name??'Recorded authorizer']]:[['','No allowed authorizer']]):'')+evidence(),'Assign reviewed invoice terms',{...values,termsId:terms.id})
 if(item.dispute)content+=`<p>Dispute ${e(item.dispute.status)} · ${e(item.dispute.evidence)}</p>`
 if(item.promise)content+=`<p>Promised ${money(item.promise.amountCents)} on ${e(item.promise.promisedOn)}</p>`
 content+=form('ar.dispute',select('Dispute status','status',[['open','Open dispute'],['resolved','Resolved dispute']])+evidence(),'Record dispute review',values)
 if(item.balance.outstandingCents>0)content+=form('ar.promise',field('Promised UTC date','promisedOn','date','','required')+field('Promised amount (USD)','amountUsd','number','','required min="0.01" step="0.01"')+evidence(),'Record payment promise',values)
 body+=box(item.number,content,{id:'ar-'+invoice.id})
 }
 return '<div class="narrow">'+body+'</div>'
}
export function filingPage(s:any,from:string,to:string){
 const report=filingTax(s,from,to)
 let body='<p><a href="/app/tax/custody">Certificates & invoice tax</a></p><form method="get" action="/app/tax/filing">'+field('From UTC date','from','date',from,'required')+field('Through UTC date','to','date',to,'required')+'<button>Review filing period</button></form>'
 body+=box('Filing-period preview',`<p>${e(report.basis)}</p><p>Separate invoice basis: tax ${money(report.invoiceBasis.invoicedTaxCents)} · credit-note tax ${money(report.invoiceBasis.creditedTaxCents)} · net ${money(report.invoiceBasis.netTaxCents)}</p><p>${report.reviewRequired?'Review required; this preview is incomplete.':'No unresolved tender in the current ledger; review jurisdiction and legal basis before filing.'}</p>`+report.groups.map(g=>`<p>${e(g.jurisdiction)} · collected tax ${money(g.collectedTaxCents)} · refund tax ${money(g.refundTaxCents)} · net ${money(g.netTaxCents)}</p>`).join('')+report.events.map(r=>`<p><a href="/app/jobs/${e(rows(s,'invoice').find(i=>i.id===r.invoiceId)?.jobId)}">${e(r.number)}</a> · ${e(r.kind)} · ${e(r.date)} · tax ${money(r.taxCents)}${r.receiptOn?' · received '+e(r.receiptOn)+' · allocated '+e(r.allocatedOn):''}</p>`).join(''))
 body+=box('Excluded amounts requiring review',report.excluded.map(r=>`<p>${e(rows(s,'invoice').find(i=>i.id===r.invoiceId)?.number)} · ${r.amountCents===undefined?'':money(r.amountCents)} · ${e(r.reason)}</p>`).join('')||'<p>No excluded amounts.</p>')
 for(const kind of ['deposit','payment'])for(const source of rows(s,kind).filter(r=>['check','other'].includes(r.method)&&!r.depositId&&!rows(s,'tenderClearance').some(c=>c.sourceId===r.id&&c.sourceKind===kind)))body+=box('Record observed clearance',`<p>${e(source.reference)} · ${money(source.amountCents)} · ${e(source.method)}. This records observed bank evidence; it never verifies funds or moves money.</p>`+form('tender.clearance',field('Observed clearance UTC date','observedOn','date','','required')+field('Bank evidence reference','reference','text','','required')+area('Owner-observed bank clearance evidence','evidence','','required'),'Record observed clearance',{sourceId:source.id,sourceKind:kind}))
 return '<div class="narrow">'+body+'</div>'
}
