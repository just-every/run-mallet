import {event,fail,find,put,rows,text,who,type Handler,type Row,type State} from './model'
import {utcDate} from './receivables'
export const clearanceCommands=['tender.clearance']
export function clearance(s:State,payment:Row){
 const source=payment.depositId?find(s,'deposit',payment.depositId):payment
 return rows(s,'tenderClearance').filter(r=>r.sourceId===source.id&&r.sourceKind===(payment.depositId?'deposit':'payment')).at(-1)
}
export const tenderClearance:Handler=(c,command,p)=>{
 if(!clearanceCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner records observed clearing evidence.',null,403)
 if(!['deposit','payment'].includes(p.sourceKind))fail('INPUT','Choose a deposit or payment source.',null,400)
 const source=find(c.s,p.sourceKind,p.sourceId)
 if(!['check','other'].includes(source.method)||p.sourceKind==='payment'&&source.depositId)fail('CLEARANCE_SOURCE','Record evidence once against the original check or other tender source.')
 const observedOn=utcDate(p.observedOn),reference=text(p.reference,'bank evidence reference'),evidence=text(p.evidence,'owner-observed bank clearance evidence',2000)
 if(observedOn>c.now.slice(0,10)||observedOn<source.at.slice(0,10))fail('CLEARANCE_DATE','Clearance must be observed between the recorded receipt and today.')
 const prior=rows(c.s,'tenderClearance').find(r=>r.sourceId===source.id&&r.sourceKind===p.sourceKind)
 if(prior){if(prior.reference===reference&&prior.observedOn===observedOn&&prior.evidence===evidence)return prior;fail('CLEARANCE_IMMUTABLE','Keep original clearance evidence; a returned tender requires the future reversal workflow.')}
 const row=put(c.s,'tenderClearance',{sourceKind:p.sourceKind,sourceId:source.id,accountId:p.sourceKind==='deposit'?source.accountId:find(c.s,'invoice',source.invoiceId).billing?.accountId??null,observedOn,reference,evidence,by:who(c),at:c.now,label:'Owner recorded observed clearance; Mallet did not verify the bank.'})
 event(c,command,null,row.id,{});return row
}
