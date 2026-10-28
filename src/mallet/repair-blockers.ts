import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'
import {blockerProjection,blockerClearance} from './repair-blocker-sources'
import {blockerNextAction} from './repair-blocker-actions'
import {privateBlockerProjection} from './repair-blocker-privacy'
import {currentRoutingHandler} from './routing'

export const repairBlockerCommands=['blocker.refresh','blocker.assign','blocker.acknowledge','blocker.sweep'] as const
const packetFor=(s:State,jobId:string)=>rows(s,'repairBlockerPacket').find(r=>r.jobId===jobId)
function currentProjection(s:State,job:Row,now?:string){
 const current=blockerProjection(s,job,now)
 // Keep missing source conditions visible rather than treating disappearance as success.
 for(const task of rows(s,'repairBlockerTask').filter(t=>t.jobId===job.id))if(!task.resolution&&!current.blockers.some(b=>b.key===task.key)&&!blockerClearance(s,job,task))current.blockers.push({key:task.key,kind:task.kind,title:'Retained blocker source needs review; fulfillment is unavailable.',source:task.source,action:{label:'Review original source',href:task.source.href}})
 current.nextAction=blockerNextAction(s,job,current.blockers)
 return rows(s,'asset').some(a=>a.id===job.assetId&&a.privacyErasedAt)?privateBlockerProjection(current):current
}
export function repairBlockerView(s:State,jobId:string,people:any[],now?:string){
 const job=find(s,'job',jobId),current=currentProjection(s,job,now),packet=packetFor(s,job.id)
 const tasks:(Row&{handlerActive:boolean;acknowledgmentCurrent:boolean})[]=rows(s,'repairBlockerTask').filter(r=>r.jobId===job.id).map(task=>({...task,handlerActive:people.some(p=>p.id===task.handler.id),acknowledgmentCurrent:task.acknowledgment?.basis===current.basis}))
 return {job,current,packet:packet??null,tasks,stale:!packet||packet.revisions.at(-1).basis!==current.basis}
}
function synchronize(c:Context,job:Row,people:any[],current=currentProjection(c.s,job,c.now)){
 const packet=packetFor(c.s,job.id),person=people.find(p=>p.id===c.actor.id)??currentRoutingHandler(c.s,job.id,people)??people.find(p=>p.role==='owner')??people[0]
 if(!person)return packet
 const fallback={id:person.id,name:person.name,role:person.role}
  let saved=packet
  if(!packet||packet.revisions.at(-1).basis!==current.basis){
   const revision={n:(packet?.revisions.length??0)+1,...current,by:who(c),at:c.now}
   saved=packet?bump(c.s,'repairBlockerPacket',packet,{revisions:[...packet.revisions,revision]}):put(c.s,'repairBlockerPacket',{jobId:job.id,revisions:[revision]})
   event(c,'blocker.refresh',job.id,saved.id,{revision:revision.n,basis:current.basis})
  }
  for(const task of rows(c.s,'repairBlockerTask').filter(t=>t.jobId===job.id&&!t.resolution)){
   const cleared=blockerClearance(c.s,job,task)
   if(cleared){const resolution={...cleared,by:who(c),at:c.now};bump(c.s,'repairBlockerTask',task,{resolution});event(c,'blocker.cleared',job.id,task.id,resolution)}
   else if(!people.some((person:any)=>person.id===task.handler.id)){
    const handler=fallback,assignment={handler,by:who(c),at:c.now};bump(c.s,'repairBlockerTask',task,{handler,assignments:[...task.assignments,assignment],acknowledgment:null});event(c,'blocker.assign',job.id,task.id,assignment)
   }
  }
  for(const blocker of current.blockers)if(!rows(c.s,'repairBlockerTask').some(t=>t.jobId===job.id&&t.key===blocker.key&&!t.resolution)){
   const routed=currentRoutingHandler(c.s,job.id,people),handler=routed?{id:routed.id,name:routed.name,role:routed.role}:fallback,task=put(c.s,'repairBlockerTask',{jobId:job.id,packetId:saved!.id,key:blocker.key,kind:blocker.kind,source:blocker.source,handler,assignments:[{handler,by:who(c),at:c.now}],acknowledgment:null,acknowledgments:[],resolution:null,openedAt:c.now})
   event(c,'blocker.opened',job.id,task.id,{key:blocker.key,source:blocker.source,handler})
  }
 return saved
}
export const repairBlockers:Handler=(c,command,p)=>{
 if(!(repairBlockerCommands as readonly string[]).includes(command))return
 if(command==='blocker.sweep'){
  if(c.actor.role!=='system')fail('FORBIDDEN','Only the scheduler may reconcile blocker sources.',null,403)
  const people=p.activePeople??[]
  return rows(c.s,'job').filter(job=>['booked','working'].includes(job.status)||packetFor(c.s,job.id)).map(job=>synchronize(c,job,people))
 }
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only a current owner or admin may manage a blocker packet.',null,403)
 const job=find(c.s,'job',p.jobId),current=currentProjection(c.s,job,c.now),packet=packetFor(c.s,job.id),people=p.activePeople??[]
 if(p.basis!==current.basis)fail('STALE_PACKET','Source records changed. Refresh the blocker packet before continuing.')
 if(integer(p.packetVersion,'packetVersion',0)!==(packet?.version??0))fail('VERSION','The saved blocker packet changed. Reload before continuing.')
 if(command==='blocker.refresh')return synchronize(c,job,people,current)
 if(!packet||packet.revisions.at(-1).basis!==current.basis)fail('STALE_PACKET','Refresh and review the current source packet first.')
 const task=find(c.s,'repairBlockerTask',p.taskId);expectVersion(task,p.taskVersion)
 if(task.jobId!==job.id||task.packetId!==packet.id)fail('BLOCKER_SCOPE','This task belongs to another repair.',null,403)
 if(task.resolution)fail('BLOCKER_RESOLVED','This source blocker has already been cleared.')
 if(command==='blocker.assign'){
  const person=people.find((o:any)=>o.id===p.handlerId)
  if(!person)fail('BLOCKER_HANDLER','Choose an active native owner or admin handler.')
  const handler={id:person.id,name:person.name,role:person.role},assignment={handler,by:who(c),at:c.now}
  const saved=bump(c.s,'repairBlockerTask',task,{handler,assignments:[...task.assignments,assignment],acknowledgment:null});event(c,command,job.id,task.id,assignment);return saved
 }
 if(task.handler.id!==c.actor.id||!people.some((o:any)=>o.id===c.actor.id))fail('BLOCKER_HANDLER','Only this blocker’s current active handler may acknowledge it.',null,403)
 if(task.acknowledgment?.basis===current.basis)fail('ACKNOWLEDGED','This handler already acknowledged the current source packet.')
 const acknowledgment={basis:current.basis,note:text(p.note,'acknowledgment note',2000),by:who(c),at:c.now},saved=bump(c.s,'repairBlockerTask',task,{acknowledgment,acknowledgments:[...task.acknowledgments,acknowledgment]})
 event(c,command,job.id,task.id,{acknowledgment});return saved
}
