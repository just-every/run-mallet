import {rows,type State} from '../model'
import {write,type CustomerScope} from './store'
import type {Sql} from '../media/types'
export function revokeCoverageAccess(scope:CustomerScope):Sql[]{
 return [{sql:"DELETE FROM mallet_coverage_authority WHERE review_id IN (SELECT id FROM mallet_records WHERE kind='coverageReview' AND json_extract(value,'$.jobId') IN (SELECT value FROM json_each(?)))",params:[JSON.stringify([...scope.jobIds])]}]
}
export function eraseCoverageContent(s:State,scope:CustomerScope,at:string):Sql[]{
 const changes:Sql[]=[]
 for(const r of rows(s,'coverageReview').filter(r=>scope.jobIds.has(r.jobId))){
  const source={...r.source,terms:'Erased personal content',...(r.kind==='service-contract'?{documentReference:'Erased personal content',evidence:'Erased personal content'}:{})}
  const history=r.history.map((h:any)=>({...h,...(h.reason?{reason:'Erased personal content'}:{})}))
  const next={...r,version:r.version+1,source,consentEvidence:'Erased personal content',basis:null,status:'erased',erasedAt:at,symptoms:r.symptoms.map((x:any)=>({reference:x.reference,reportedAt:x.reportedAt,by:x.by,at:x.at,erasedAt:at})),history:[...history,{action:'erased',at,by:{id:'retention',name:'Owner-authorized erasure',role:'system'}}]}
  changes.push(write('coverageReview',next))
  const task=rows(s,'coverageTask').find(t=>t.coverageId===r.id)
  if(task)changes.push(write('coverageTask',{...task,version:task.version+1,status:task.status==='open'?'suppressed':task.status,resolution:{action:'erased',reason:'Erased personal content',at,by:next.history.at(-1)!.by}}))
 }
 return changes
}
