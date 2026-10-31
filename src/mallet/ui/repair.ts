import {timeSeconds} from '../time'
// One repair order as the screens read it: its job, vehicle, estimate, invoice and any plan waiting for a person,
// the board column it stands in and its blocker chip. Everything here is derived from records; nothing is stored.
import {rows,type Tone} from './common'
import {jobEstimates,authorizedCap} from '../supplement-scope'
import {flowStage,stages,type Stage} from '../flow'

export type Column=Stage
export const columns:[Column,string][]=stages.map(([id,label])=>[id,label])
const shared:Record<string,string>={phone:'by phone',email:'by email',printed:'on paper','in person':'in person','manual share':'by hand'}

export type Repair={job:any,asset:any,estimate:any,rev:any,invoice:any,plans:any[],column:Column,chip:[string,Tone],sold:number,clocked:number}

// Sold hours are authorized labor; clocked hours come only from elapsed TIME-001 timer intervals.
function hours(state:any,job:any) {
 const sold=jobEstimates(state,job).reduce((sum,q)=>sum+q.revisions.at(-1).lines.filter((l:any)=>l.kind==='labor'&&q.authorisation?.lineIds.includes(l.id)).reduce((n:number,l:any)=>n+authorizedCap(state,q,l),0),0)/1000
 const clocked=rows(state,'timeEntry').filter(t=>t.kind==='job'&&t.jobId===job.id).reduce((n:number,t:any)=>n+timeSeconds(t),0)/3600
 return {sold,clocked}
}
export const clock=(hrs:number)=>{const minutes=Math.round(hrs*60);return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`}
// "In bay 1 · 1:54/3.6 h": each half keeps its words together, so a narrow chip wraps only after the dot.
const inBay=(bay:string,hours:string)=>[`In ${bay.replace(/^Bay\b/,'bay')||'the bay'}`,hours].filter(Boolean).map(s=>s.replace(/ /g,'\u00a0')).join('\u00a0· ')
export const hrs=(value:number)=>`${Number(value.toFixed(2))} hr${value===1?'':'s'}`

export function repair(state:any,job:any):Repair {
 const asset=rows(state,'asset').find(a=>a.id===job.assetId)??job.asset,estimate=rows(state,'estimate').find(x=>x.id===job.estimateId),invoice=rows(state,'invoice').find(x=>x.jobId===job.id)
 const rev=estimate?.revisions?.at(-1),plans=rows(state,'proposal').filter(p=>p.jobId===job.id&&p.status==='pending'),{sold,clocked}=hours(state,job)
 const column=flowStage(state,job)
 let chip:[string,Tone]=['Booked','']
 if(job.status==='canceled'||job.status==='lost')chip=[job.status==='lost'?'Lost':'Canceled','']
 else if(column==='closed')chip=['Collected and invoiced','']
 else if(column==='collected')chip=['Collected · invoice not exported','green']
 else if(column==='ready')chip=job.status==='invoiced'?['Invoiced · not collected','amber']:invoice?.status==='approved'?['Ready for pickup','green']:invoice?['Invoice draft','amber']:['Ready to invoice','']
 else if(column==='quality')chip=['Quality check','violet']
 else if(column==='parts')chip=['Waiting for parts','amber']
 else if(column==='work'&&job.status==='working')chip=[inBay(job.bayId,sold?`${clock(clocked)}/${Number(sold.toFixed(2))} h`:''),'violet']
 else if(column==='work'&&estimate?.authorisation){const n=estimate.authorisation.lineIds.length,of=rev.lines.length;chip=[n===of?(n===1?'Authorized':`All ${n} authorized`):`${n} of ${of} authorized`,'green']}
 else if(column==='work')chip=['Authorized','green']
 else if(column==='approval'&&estimate?.status==='declined')chip=['All work declined','amber']
 else if(column==='approval'&&estimate?.status==='sent')chip=[`Shared ${shared[estimate.sent.at(-1)?.method]??''}`.trim(),'amber']
 else if(column==='approval'&&estimate?.status==='authorised')chip=['Supplement waiting','amber']
 else if(column==='approval'&&estimate)chip=estimate.status==='approved'?['Ready to share','cyan']:rev.preparedBy.role==='agent'?['Draft to approve','amber']:['Draft','']
 else if(column==='diagnosis')chip=['Diagnosis','cyan']
 if(plans.length&&column!=='closed')chip=['Needs approval','amber']
 return {job,asset,estimate,rev,invoice,plans,column,chip,sold,clocked}
}

// Work an agent prepared that waits for a person: draft estimates, dispatch plans and invoice drafts.
export function waiting(state:any) {
 const estimates=rows(state,'estimate').filter(x=>x.status==='draft'&&x.revisions.at(-1).preparedBy.role==='agent')
 const plans=rows(state,'proposal').filter(p=>p.status==='pending'&&p.preparedBy.role==='agent')
 const invoices=rows(state,'invoice').filter(x=>x.status==='draft'&&x.preparedBy.role==='agent')
 const agents=[...estimates.map(x=>x.revisions.at(-1).preparedBy.name),...plans.map(p=>p.preparedBy.name),...invoices.map(x=>x.preparedBy.name)]
 return {estimates,plans,invoices,agent:agents[0] as string|undefined,total:estimates.length+plans.length+invoices.length,jobIds:[...plans.map(p=>p.jobId),...estimates.map(x=>x.jobId),...invoices.map(x=>x.jobId)]}
}

// What each recorded event reads as on the board's activity list and a repair order's history.
export const eventNames:Record<string,string>={'diagnosis.record':'Diagnosis recorded','diagnosis.share':'Diagnosis sharing changed','diagnosisLink.create':'Customer inspection link created','diagnosisLink.revoke':'Customer inspection link revoked','time.clockIn':'Clocked in','time.clockOut':'Clocked out','time.breakStart':'Break started','time.breakEnd':'Break ended','time.start':'Job timer started','time.pause':'Job timer paused','time.correct':'Time correction proposed','time.approveCorrection':'Time correction approved','recipe.prepare':'Service package estimate prepared','pricing.save':'Pricing matrix revision saved','inspectionJob.save':'Service recipe revision saved','inspectionTemplate.save':'Inspection template revision saved','inspection.assign':'Inspection assigned','inspection.record':'Inspection observation recorded','inspection.estimate':'Estimate prepared from inspection','quality.takeover':'Technician assignment taken over','quality.configure':'Quality checklist defined','quality.record':'Quality check recorded','quality.correct':'Corrective work linked','quality.signTechnician':'Technician signed checks','quality.signQuality':'Independent quality decision','quality.override':'Quality exception authorized','decline.record':'Declined work saved','decline.reprice':'Declined work repriced','reading.record':'Mileage or hours recorded','serviceInterval.save':'Service due trigger saved','asset.create':'Vehicle registered','asset.update':'Vehicle updated','job.book':'Visit booked','estimate.prepare':'Estimate prepared','estimate.revise':'Estimate revised','estimate.approve':'Estimate approved','estimate.markSent':'Estimate shared','estimate.authorise':'Customer authorization recorded','work.record':'Parts or labor recorded','job.complete':'Repair completed','invoice.prepare':'Invoice prepared','invoice.approve':'Invoice approved','invoice.export':'Invoice exported','dispatch.prepare':'Dispatch change prepared','dispatch.approve':'Dispatch change approved','dispatch.withdraw':'Dispatch proposal withdrawn','flow.priority':'Board priority changed','flow.close':'Repair closed without work','flow.collect':'Collection recorded by staff'}
