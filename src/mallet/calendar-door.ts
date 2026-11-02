import type {Bindings} from '../auth.server'
import type {Authority} from './auth'
import {load,rows,fail} from './model'
/** Native calendar entries resolve staff here; historical free-text repairs keep their existing boundary. */
export async function calendarAuthority(env:Bindings,command:string,input:any,authority:Authority){
 let technicianId=input.technicianId
 if(command==='dispatch.approve')technicianId=rows(await load(env.DB),'proposal').find(p=>p.id===input.proposalId)?.plan.technicianId
 if(!technicianId)return authority
 const native=await env.DB.prepare('SELECT id,status FROM oa_operators WHERE id=?').bind(technicianId).first<{id:string,status:string}>()
 const mustResolve=command==='calendar.seriesCreate'||command==='calendar.technicianSave'||command==='calendar.absenceSave'
 if(mustResolve&&!native)fail('INPUT','Choose a native staff member.',null,400)
 const needsActive=['job.book','dispatch.approve','location.transferRepair','calendar.seriesCreate'].includes(command)||command==='calendar.technicianSave'&&input.active===true
 if(!needsActive||!native)return authority
 if(native.status!=='active')fail('BOOKING_CAPACITY','That staff member is no longer active.')
 return {sql:'('+authority.sql+") AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",params:[...authority.params,technicianId]}
}
