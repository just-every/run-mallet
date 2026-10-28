import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type State} from './model'

/** Reusable timing suggestions never grant consent, approval or sending authority. */
export function configureAppointmentReminders(c:Context,p:any){
 if(!Array.isArray(p.steps)||p.steps.length<1||p.steps.length>3)fail('INPUT','Configure one to three reminder steps.',null,400)
 const steps=p.steps.map((step:any)=>({minutesBefore:integer(step.minutesBefore,'minutes before appointment',1,31*1440),instructions:text(step.instructions,'pre-visit instructions',2000)}))
 if(new Set(steps.map((step:any)=>step.minutesBefore)).size!==steps.length)fail('INPUT','Use distinct reminder times.',null,400)
 const prior=rows(c.s,'appointmentReminderPolicy')[0],value={steps,enabled:p.enabled===true,by:who(c),at:c.now,policy:'review-each-appointment-email-v1'}
 let row
 if(prior){expectVersion(prior,p.version);row=bump(c.s,'appointmentReminderPolicy',prior,{...value,history:[...(prior.history??[]),{...prior,history:undefined}]})}
 else{if(p.version!==0)fail('VERSION','New reminder settings need version zero.');row=put(c.s,'appointmentReminderPolicy',{...value,history:[]})}
 event(c,'outreach.configure',null,row.id,{version:row.version});return row
}
export function appointmentReminderStep(s:State,index:unknown){
 if(index===undefined||index===null||index==='')return null
 const policy=rows(s,'appointmentReminderPolicy')[0]
 if(!policy?.enabled)fail('OUTREACH_POLICY','Reminder series is not enabled.')
 const stepIndex=integer(index,'reminder step',0,policy.steps.length-1)
 return {policyId:policy.id,policyVersion:policy.version,index:stepIndex,...policy.steps[stepIndex]}
}
export function currentReminderStep(s:State,step:any){
 const policy=find(s,'appointmentReminderPolicy',step.policyId)
 if(!policy.enabled||policy.version!==step.policyVersion||JSON.stringify(policy.steps[step.index])!==JSON.stringify({minutesBefore:step.minutesBefore,instructions:step.instructions}))fail('OUTREACH_POLICY','Reminder configuration changed. Record fresh customer permission and review the new exact email.')
 return step
}
export const stepDue=(a:any,step:any)=>new Date(Date.parse(a.startAt)-step.minutesBefore*60000).toISOString()
