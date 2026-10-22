import {e,box,linkRow,join,when,person,type Names} from './common'
type Clash={href?:string,jobId:string,title:string,bayId:string,technicianId:string,startAt:string,endAt:string,resources:string[]}
// A refused booking or dispatch change: the visits it overlaps, each linked, and the way back to what was being entered.
export function conflictPage(clashes:Clash[],names:Names,back:{href:string,label:string}) {
 const shared=(c:Clash)=>`Same ${c.resources.join(' and ')}`
 return box('That time is already booked',`<p role="alert">Nothing was saved. The chosen capacity is unavailable or lacks the required qualification. Choose another time, resource or technician.</p><ul class="list">${clashes.map(c=>linkRow(c.href??`/app/jobs/${c.jobId}`,c.title,`${when(c.startAt,c.endAt)} · ${join(c.bayId,person(names,c.technicianId))} · ${e(shared(c))}`)).join('')}</ul><p class="card-foot"><a href="${e(back.href)}">${e(back.label)}</a> · <a href="/app">Return to the board</a></p>`)
}
