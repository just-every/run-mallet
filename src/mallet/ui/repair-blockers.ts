import {area,box,e,form,role,select,when} from './common'

type Citation={kind:string,id:string,version:number,revision?:number,itemId?:string,lineId?:string,label:string,href:string}
const groups:[string,string][]=[['intake','Intake'],['diagnostics','Diagnostics'],['authorization','Authorization'],['parts','Parts'],['progress','Progress'],['promises','Promises']]
const kinds:Record<string,string>={evidence:'Evidence needed',consent:'Customer consent needed',backorder:'Parts backorder'}
const citation=(source:Citation)=>`<a href="${e(source.href)}">${e(source.label)}</a><span class="row-meta"> · ${e(source.kind)} · ${e(source.id)} · version ${e(source.version)}${source.revision!==undefined?` · revision ${e(source.revision)}`:''}${source.itemId?` · item ${e(source.itemId)}`:''}${source.lineId?` · line ${e(source.lineId)}`:''}</span>`
const sourceList=(sources:Record<string,Citation[]>)=>groups.map(([key,label])=>`<h3>${label}</h3><ul class="list">${(sources[key]??[]).map(source=>`<li class="plain">${citation(source)}</li>`).join('')||'<li class="plain">No source recorded.</li>'}</ul>`).join('')
const proposals=(items:any[])=>{
 const permitted=items.filter(item=>['estimate','dispatch'].includes(item.kind))
 return permitted.length?`<ul class="list">${permitted.map(item=>`<li class="plain"><a href="${e(item.href)}">${e(item.label)}</a><span class="row-meta">${item.kind==='estimate'?'Estimate':'Dispatch proposal'} · ${e(item.id)} · version ${e(item.version)}${item.revision!==undefined?` · revision ${e(item.revision)}`:''}</span></li>`).join('')}</ul>`:'<p>No prepared estimate or dispatch proposals.</p>'
}
const progress=(value:any)=>`<dl><dt>Stage</dt><dd>${e(value.stage)}</dd><dt>Repair status</dt><dd>${e(value.status)}</dd><dt>Recorded parts and labor entries</dt><dd>${e(value.recordedActuals)}</dd><dt>Remaining authorized labor</dt><dd>${e(value.remainingHours)} hours</dd><dt>Customer pickup promise</dt><dd>${value.promiseAt?when(value.promiseAt):'No pickup promise recorded'}</dd></dl>`
const handler=(value:any)=>`${e(value.name)} · ${e(role(value.role))}`
function acknowledgment(task:any){
 const receipt=task.acknowledgment
 if(!receipt)return '<p>No acknowledgment recorded.</p>'
 return `<p><strong>${task.acknowledgmentCurrent?'Acknowledged against current sources':'Earlier acknowledgment is stale'}</strong> · ${e(receipt.by.name)} · ${when(receipt.at)}</p><p>${e(receipt.note)}</p>`
}
function taskControls(view:any,task:any,people:any[],actor:any){
 if(view.stale||task.resolution)return ''
 const fences={jobId:view.job.id,packetVersion:view.packet.version,basis:view.current.basis,taskId:task.id,taskVersion:task.version}
 const eligible=people.filter(person=>person.status==='active'&&['owner','admin'].includes(person.role))
 const assignment=eligible.length?`<details><summary>Assign a handler</summary>${form('blocker.assign',select('Handler','handlerId',eligible.map(person=>[person.id,`${person.name} · ${role(person.role)}`]),task.handler.id),'Assign handler',fences)}</details>`:'<p>No active owner or service advisor is available for assignment.</p>'
 const acknowledge=task.handler.id===actor.id&&task.handlerActive&&!task.acknowledgmentCurrent?form('blocker.acknowledge',area('Acknowledgment note','note','','required maxlength="2000" rows="3"'),'Acknowledge blocker',fences):''
 return assignment+acknowledge
}
function blockerCard(view:any,blocker:any,index:number,people:any[],actor:any){
 const task=view.tasks.find((item:any)=>item.key===blocker.key&&!item.resolution)
 const ownership=task?`<p><strong>Handler:</strong> ${handler(task.handler)}${task.handlerActive?'':' · Inactive; assign an active handler'}</p>${acknowledgment(task)}${taskControls(view,task,people,actor)}`:'<p>Refresh the blocker packet to open its handler task.</p>'
 return box(`${index+1}. ${blocker.title}`,`<ul class="list"><li class="plain"><span class="row-meta">${e(kinds[blocker.kind]??blocker.kind)}</span>${citation(blocker.source)}</li><li class="plain"><a href="${e(blocker.action.href)}">${e(blocker.action.label)}</a></li></ul>${ownership}`)
}
function taskHistory(tasks:any[],basis:string){
 return tasks.length?`<ul class="list">${tasks.map(task=>`<li class="plain"><h3>${e(kinds[task.kind]??task.kind)} · ${task.resolution?'Resolved':'Unresolved'}</h3><p>Opened ${when(task.openedAt)}</p><p>Current handler: ${handler(task.handler)}${task.handlerActive?'':' · Inactive'}</p><p>Original source: ${citation(task.source)}</p>${acknowledgment(task)}<details><summary>Assignments and acknowledgments</summary><h3>Assignments</h3><ul class="list">${task.assignments.map((assignment:any)=>`<li class="plain">${handler(assignment.handler)} · assigned by ${e(assignment.by.name)} · ${when(assignment.at)}</li>`).join('')||'<li class="plain">No assignments recorded.</li>'}</ul><h3>Acknowledgments</h3><ul class="list">${task.acknowledgments.map((receipt:any)=>`<li class="plain"><strong>${receipt.basis===basis?'Current source basis':'Earlier source basis; stale'}</strong><span>${e(receipt.by.name)} · ${when(receipt.at)}</span><p>${e(receipt.note)}</p></li>`).join('')||'<li class="plain">No acknowledgments recorded.</li>'}</ul></details>${task.resolution?`<p><strong>Resolution:</strong> ${e(task.resolution.reason)} · ${e(task.resolution.by.name)} · ${when(task.resolution.at)}</p><p>Resolution source: ${citation(task.resolution.source)}</p>`:'<p>No resolution recorded.</p>'}</li>`).join('')}</ul>`:'<p>No blocker tasks have been recorded.</p>'
}
function packetHistory(packet:any){
 if(!packet)return '<p>No blocker packet has been saved.</p>'
 return `<details><summary>Packet revision history (${packet.revisions.length})</summary><ul class="list">${packet.revisions.map((revision:any)=>`<li class="plain"><details><summary>Revision ${e(revision.n)} · ${when(revision.at)} · ${e(revision.by.name)}</summary><h3>Recorded blockers</h3><ul class="list">${revision.blockers.map((blocker:any)=>`<li class="plain"><strong>${e(blocker.title)}</strong>${citation(blocker.source)}</li>`).join('')||'<li class="plain">No blockers recorded in this revision. This does not mean the repair is complete.</li>'}</ul><h3>Recorded repair progress</h3>${progress(revision.progress)}<h3>Prepared proposals</h3>${proposals(revision.proposals)}<details><summary>Sources for this revision</summary>${sourceList(revision.sources)}</details></details></li>`).join('')}</ul></details>`
}
export function repairBlockersPage(view:any,people:any[],actor:any):string{
 if(!['owner','admin'].includes(actor.role))return ''
 const {job,current,packet,stale}=view
 const refresh=form('blocker.refresh','', 'Refresh blocker packet',{jobId:job.id,packetVersion:packet?.version??0,basis:current.basis})
 const overview=box('Source-cited repair blockers',`<ul class="list"><li class="plain"><a href="/app/jobs/${e(job.id)}">Return to ${e(job.title)}</a></li></ul><p>${!packet?'No packet saved yet. Refresh to record the current sources and open blocker tasks.':stale?'Native sources changed since the saved packet. Refresh before assigning or acknowledging blockers.':`The saved packet matches sources read ${when(view.observedAt)}.`}</p><p>Blockers are separate from completed work and the customer pickup promise.</p>${refresh}`)
 const live=current.blockers.length?current.blockers.map((blocker:any,index:number)=>blockerCard(view,blocker,index,people,actor)).join(''):box('Current blockers','<p>No current evidence, consent or backorder blockers were found. This does not mean the repair is complete.</p>')
 const references=box('Current source details',`<details><summary>Sources grouped by repair stage</summary>${sourceList(current.sources)}</details>${packetHistory(packet)}`)
 const reviews=box('Prepared proposals',`<p>Review prepared estimates and dispatch proposals in the repair’s native review controls.</p>${proposals(current.proposals)}`)
 const history=box('Blocker task history',`<p>Resolutions retain the source that cleared each blocker. A resolved blocker does not complete the repair.</p><details><summary>Handler, acknowledgment and resolution history (${view.tasks.length})</summary>${taskHistory(view.tasks,current.basis)}</details>`)
 return `${overview}<div class="grid"><div class="col">${live}${history}</div><div class="col">${box('Repair progress and pickup promise',progress(current.progress))}${reviews}${references}</div></div>`
}
