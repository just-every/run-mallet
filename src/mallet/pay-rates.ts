import {bump,expectVersion,fail,integer,put,rows,text,who,type Handler,type State} from './model'
export const payRateCommands=['payRate.set'] as const
export function utcDate(value:unknown,label:string) {
 const day=text(value,label,10)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)fail('INPUT',`${label} must be a YYYY-MM-DD date.`,null,400)
 return day
}
// Payroll rates are owner-only: they are never emitted as events and only the owner's state carries them.
export const payRates:Handler=(c,command,p)=>{
 if(command!=='payRate.set')return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner sets payroll rates.',null,403)
 const technicianId=text(p.technicianId,'technicianId',100)
 const revision={centsPerHour:integer(p.centsPerHour,'hourly pay rate in cents',0,1_000_000),effectiveFrom:utcDate(p.effectiveFrom,'effective from'),reason:text(p.reason,'rate change reason',500),by:who(c),at:c.now}
 const existing=rows(c.s,'payRate').find(r=>r.technicianId===technicianId)
 if(!existing)return put(c.s,'payRate',{technicianId,revisions:[revision]})
 expectVersion(existing,p.version)
 return bump(c.s,'payRate',existing,{revisions:[...existing.revisions,revision]})
}
/** The rate for a UTC date: the greatest effective-from on or before it, ties going to the latest save. */
export function rateOn(s:State,technicianId:string,day:string):number|null {
 let best:any=null
 for(const r of rows(s,'payRate').find(x=>x.technicianId===technicianId)?.revisions??[])if(r.effectiveFrom<=day&&(!best||r.effectiveFrom>=best.effectiveFrom))best=r
 return best?.centsPerHour??null
}
