import {fail,rows,type Row,type State} from '../model'
import {totals} from '../money'
import {shopTimeZone} from '../promise-zone'

const DAY=86_400_000
function calendarDate(value:string,label:string):string {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('INPUT',`${label} must be a YYYY-MM-DD date.`,null,400)
 const time=Date.parse(value+'T00:00:00Z')
 if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)fail('INPUT',`${label} must be a real calendar date.`,null,400)
 return value
}
const sum=(values:number[])=>values.reduce((total,value)=>{
 const next=total+value
 if(!Number.isSafeInteger(next))fail('MONEY','The report amount is too large.',null,400)
 return next
},0)
const roundedRatio=(n:number,d:number,scale=1)=>d?Number((BigInt(n)*BigInt(scale)*2n+BigInt(d))/(BigInt(d)*2n)):null
const jobUrl=(id:string)=>'/app/jobs/'+encodeURIComponent(id)

/** Read-only projection of retained invoices and exact customer decisions. Never a settlement report. */
export function salesReport(s:State,params:URLSearchParams,now=new Date().toISOString()) {
 for(const key of params.keys())if(!['from','to','location','format'].includes(key)||params.getAll(key).length!==1)fail('INPUT',`Unsupported or repeated report filter: ${key}.`,null,400)
 if(params.has('location')&&params.get('location')!=='installation')fail('INPUT','Only this installation is available; multiple locations are not implemented.',null,400)
 const timeZone=shopTimeZone(s),formatter=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'})
 const localDate=(at:string)=>{
  const parts=Object.fromEntries(formatter.formatToParts(new Date(at)).map(p=>[p.type,p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
 }
 const today=localDate(now),from=calendarDate(params.get('from')??today,'from'),to=calendarDate(params.get('to')??today,'to')
 const span=Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z')
 if(span<0||span>=366*DAY)fail('INPUT','Choose 1–366 inclusive calendar days, with from on or before to.',null,400)
 const inPeriod=(at:string|undefined)=>!!at&&localDate(at)>=from&&localDate(at)<=to
 const jobs=rows(s,'job'),invoices=rows(s,'invoice'),estimates=rows(s,'estimate')
 const completed=jobs.filter(j=>['completed','invoiced'].includes(j.status)&&inPeriod(j.completedAt)).map(job=>{
  const invoice=invoices.find(i=>i.jobId===job.id&&['approved','exported'].includes(i.status)&&i.approval)
  const credits=invoice?rows(s,'creditNote').filter(n=>n.invoiceId===invoice.id):[],credited=totals(credits.map(n=>n.totals)),adjusted=invoice?{subtotalCents:invoice.totals.subtotalCents-credited.subtotalCents,salesTaxCents:invoice.totals.salesTaxCents-credited.salesTaxCents,totalCents:invoice.totals.totalCents-credited.totalCents}:null
  return {jobId:job.id,jobUrl:jobUrl(job.id),completedAt:job.completedAt as string,advisor:job.bookedBy,excluded:!!invoice&&credits.length>0&&adjusted!.totalCents===0,credits:credits.map(n=>({id:n.id,number:n.number,at:n.at,reason:'Issued credit note',totals:n.totals,refunds:rows(s,'refund').filter(r=>r.creditNoteId===n.id).map(r=>({id:r.id,status:r.redirect?.status??r.status,amountCents:r.amountCents}))})),invoice:invoice?{id:invoice.id,number:invoice.number,status:invoice.status,revision:invoice.revision,originalTotals:invoice.totals,...adjusted!}:null}
 }).sort((a,b)=>a.completedAt.localeCompare(b.completedAt)||a.jobId.localeCompare(b.jobId))
 const billed=completed.filter((r):r is typeof r&{invoice:NonNullable<typeof r.invoice>}=>r.invoice!==null&&!r.excluded)
 const netSalesCents=sum(billed.map(r=>r.invoice.subtotalCents)),salesTaxCents=sum(billed.map(r=>r.invoice.salesTaxCents)),grossSalesCents=sum(billed.map(r=>r.invoice.totalCents))
 const decisions=estimates.filter(q=>inPeriod(q.authorisation?.at)).map(q=>{
  const decision=q.authorisation,revision=q.revisions.find((r:any)=>r.n===decision.revision)
  if(!revision)fail('SOURCE_INCOMPLETE','A customer decision is missing its exact estimate revision; repair the source before reporting.',{estimateId:q.id})
  const lines=revision.lines.map((l:any)=>({id:l.id,description:l.description,kind:l.kind,quantity:l.quantity,subtotalCents:l.subtotalCents,salesTaxCents:l.salesTaxCents,totalCents:l.totalCents,authorized:decision.lineIds.includes(l.id)}))
  return {jobId:q.jobId,jobUrl:jobUrl(q.jobId),estimateId:q.id,revision:revision.n,supplementOf:q.supplementOf??null,decidedAt:decision.at as string,recordedBy:decision.recordedBy??null,method:decision.method,authorized:decision.lineIds.length>0,
   authorizedValue:totals(lines.filter((l:any)=>l.authorized)),declinedValue:totals(lines.filter((l:any)=>!l.authorized)),lines}
 }).sort((a,b)=>a.decidedAt.localeCompare(b.decidedAt)||a.estimateId.localeCompare(b.estimateId))
 const approved=decisions.filter(d=>d.authorized).length
 // Root-estimate cohort: later decisions and closures remain linked to the original preparation period.
 const cohort=estimates.filter(q=>!q.supplementOf&&inPeriod(q.createdAt)).map(q=>{
  const job=jobs.find(j=>j.id===q.jobId)!,invoice=invoices.find(i=>i.jobId===q.jobId),collection=rows(s,'flow').find(f=>f.jobId===q.jobId)?.collection
  return {jobId:q.jobId,jobUrl:jobUrl(q.jobId),estimateId:q.id,preparedAt:q.createdAt,advisor:job.bookedBy,decision:q.authorisation?{revision:q.authorisation.revision,at:q.authorisation.at,approved:q.authorisation.lineIds.length>0}:null,completed:!!job.completedAt,collected:!!collection,closed:!!collection&&invoice?.status==='exported',excluded:['canceled','lost'].includes(job.status),outcome:job.status}
 })
 const closeSummary=(sources:typeof cohort)=>{const estimated=sources.length,approved=sources.filter(r=>r.decision?.approved).length,declined=sources.filter(r=>r.decision&&!r.decision.approved).length,completed=sources.filter(r=>r.completed).length,collected=sources.filter(r=>r.collected).length,closed=sources.filter(r=>r.closed).length;return {estimated,approved,declined,undecided:estimated-approved-declined,completed,collected,closed,canceledOrLost:sources.filter(r=>r.excluded).length,approvalRatioTenths:roundedRatio(approved,estimated,1000),completionRatioTenths:roundedRatio(completed,approved,1000),collectionRatioTenths:roundedRatio(collected,completed,1000),closeRatioTenths:roundedRatio(closed,estimated,1000)}}
 const closeFunnel={...closeSummary(cohort),sources:cohort}
 const advisorIds=[...new Set([...cohort.map(r=>r.advisor?.id),...completed.map(r=>r.advisor?.id)])].sort()
 const advisors=advisorIds.map(id=>{const sources=completed.filter(r=>r.advisor?.id===id),eligible=sources.filter((r):r is typeof r&{invoice:NonNullable<typeof r.invoice>}=>!!r.invoice&&!r.excluded),netSalesCents=sum(eligible.map(r=>r.invoice.subtotalCents)),funnelSources=cohort.filter(r=>r.advisor?.id===id);return {advisor:cohort.find(r=>r.advisor?.id===id)?.advisor??sources[0]?.advisor??null,netSalesCents,invoicedRepairCount:eligible.length,averageRepairOrderCents:roundedRatio(netSalesCents,eligible.length),closeFunnel:closeSummary(funnelSources),salesSources:sources,funnelSources}})

 return {schema:'mallet-sales-report/v1',currency:'USD',period:{from,to,timeZone,inclusive:true},location:'installation',
  definitions:{sales:'Approved or exported invoices on repairs completed in this period, less all issued credit notes as of this read; pretax after discounts. Refund outcomes are disclosed but never deducted twice. Not cash collected or settled.',completedVehicleCount:'Completed or invoiced repair orders in the period, including those without an approved invoice; fully credited invoices are excluded from car count and the ARO denominator, with their sources retained. Repeat visits count separately.',aro:'Pretax invoice sales divided by completed repairs with an approved or exported invoice; half up to cents; null for no invoices.',approvalRatio:'Customer decisions accepting at least one line divided by all recorded customer decisions in this period; tenths of a percent, half up; null for no decisions.',decisionValues:'Original authorized and declined pretax line values by decision date, including supplements and decisions on later canceled/lost repairs. Subsequent replacements do not rewrite earlier decisions. Not realized sales.',dates:'Inclusive installation-local calendar dates: completion time for sales, customer-decision time for decision values. Open, canceled or lost repairs and draft invoices contribute no sales.',closeFunnel:'Root estimates prepared in the period form one repair cohort. Approval and close divide by estimated, completion by approved, collection by completed. Closed means collection recorded and invoice exported. Current later outcomes are included; supplements are decision sources only.',advisor:'Booking recorder is the accountable advisor until GOV-001 adds advisor roles. Comparison uses identical sales and cohort denominators; original attribution is retained.',limitations:'Multiple locations require SHOP-001; this is not a settlement report.'},
  sales:{completedVehicleCount:completed.filter(r=>!r.excluded).length,invoicedRepairCount:billed.length,completedWithoutApprovedInvoice:completed.filter(r=>!r.invoice).length,netSalesCents,salesTaxCents,grossSalesCents,averageRepairOrderCents:roundedRatio(netSalesCents,billed.length),sources:completed},
  funnel:{decisionCount:decisions.length,approvedDecisionCount:approved,fullyDeclinedDecisionCount:decisions.length-approved,approvalRatioTenths:roundedRatio(approved,decisions.length,1000),authorizedSubtotalCents:sum(decisions.map(d=>d.authorizedValue.subtotalCents)),declinedSubtotalCents:sum(decisions.map(d=>d.declinedValue.subtotalCents)),sources:decisions},closeFunnel,advisors}
}
export type SalesReport=ReturnType<typeof salesReport>
const cell=(value:unknown)=>{
 const raw=String(value??''),safe=/^[=+\-@\t\r\n]/.test(raw)?"'"+raw:raw
 return '"'+safe.replaceAll('"','""')+'"'
}
/** One auditable document: definitions and summary, followed by every contributing RO and decision line. */
export function salesReportCsv(report:SalesReport):string {
 const records:unknown[][]=[['Record','Metric','Value','JobId','JobURL','SourceId','Revision','At','LineId','Description','Authorized','SubtotalCents','SalesTaxCents','TotalCents'],['period','from',report.period.from],['period','to',report.period.to],['period','timeZone',report.period.timeZone],['period','location',report.location],['period','currency',report.currency]]
 for(const [key,value] of Object.entries(report.definitions))records.push(['definition',key,value])
 for(const [key,value] of Object.entries(report.sales))if(key!=='sources')records.push(['summary',key,value])
 for(const [key,value] of Object.entries(report.funnel))if(key!=='sources')records.push(['summary',key,value])
 for(const source of report.sales.sources)records.push(['completed-repair','','',source.jobId,source.jobUrl,source.invoice?.id,source.invoice?.revision,source.completedAt,'',source.invoice?.number??'No approved invoice','',source.invoice?.subtotalCents,source.invoice?.salesTaxCents,source.invoice?.totalCents])
 for(const source of report.funnel.sources)for(const line of source.lines)records.push(['decision-line','','',source.jobId,source.jobUrl,source.estimateId,source.revision,source.decidedAt,line.id,line.description,line.authorized,line.subtotalCents,line.salesTaxCents,line.totalCents])
 for(const [key,value]of Object.entries(report.closeFunnel))if(key!=='sources')records.push(['close-summary',key,value])
 for(const source of report.closeFunnel.sources)records.push(['close-source',source.outcome,'',source.jobId,source.jobUrl,source.estimateId,source.decision?.revision,source.preparedAt,'',JSON.stringify({decision:source.decision,completed:source.completed,collected:source.collected,closed:source.closed})])
 for(const source of report.sales.sources)for(const credit of source.credits)records.push(['credit-note',source.excluded?'fully-credited-exclusion':'sales-adjustment','',source.jobId,source.jobUrl,credit.id,'',credit.at,'',credit.reason,'',-credit.totals.subtotalCents,-credit.totals.salesTaxCents,-credit.totals.totalCents])
 for(const advisor of report.advisors)records.push(['advisor',advisor.advisor?.name,advisor.netSalesCents,'','','','','','',JSON.stringify({advisor:advisor.advisor,closeFunnel:advisor.closeFunnel,averageRepairOrderCents:advisor.averageRepairOrderCents})])
 return records.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
