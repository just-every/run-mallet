import {bump,expectVersion,fail,integer,put,rows,text,who,type Handler,type State} from '../model'
import {utcDate} from '../pay-rates'

export const costRateCommands=['costRate.set'] as const
/** Loaded hourly cost is an explicit owner declaration, separate from payroll wages. */
export const costRates:Handler=(c,command,p)=>{
 if(command!=='costRate.set')return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner sets loaded labor costs.',null,403)
 const technicianId=text(p.technicianId,'technician',100)
 const day=String(p.effectiveFrom??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)fail('INPUT','Choose a real effective UTC date.',null,400)
 const revision={centsPerHour:integer(p.centsPerHour,'loaded hourly cost in USD cents',0,1_000_000),effectiveFrom:utcDate(p.effectiveFrom,'effective from'),reason:text(p.reason,'loaded cost basis',2000),by:who(c),at:c.now}
 const old=rows(c.s,'costRate').find(r=>r.technicianId===technicianId)
 if(old)expectVersion(old,p.version)
 else if(p.version!==0)fail('VERSION','A new loaded rate requires version zero.')
 return old?bump(c.s,'costRate',old,{revisions:[...old.revisions,revision]}):put(c.s,'costRate',{technicianId,revisions:[revision]})
}
export function costRateOn(s:State,technicianId:string,date:string){
 const row=rows(s,'costRate').find(r=>r.technicianId===technicianId)
 let selected:any=null,index=-1
 for(const [n,r]of (row?.revisions??[]).entries())if(r.effectiveFrom<=date&&(!selected||r.effectiveFrom>=selected.effectiveFrom)){selected=r;index=n}
 return selected?{id:row!.id,revision:index+1,...selected}:null
}
