import assert from 'node:assert/strict'
import {draftLines,revisedLines,revisedNotes,draftTotals,revisedTotals} from './preparation-fixtures.mjs'

const rows=(state,kind)=>state.records[kind]??[]
const jobAt=(state,id)=>rows(state,'job').find(row=>row.id===id)
const entered=line=>({kind:line.kind,description:line.description,quantity:line.quantity,unitCents:line.unitCents})
const withoutId=({id,...line})=>line

function assertRevision(revision,{n,lines,totals,notes}){
 assert.equal(revision.n,n)
 assert.deepEqual(revision.lines.map(entered),lines,'Revision retains the independently specified lines')
 assert.ok(revision.lines.every(line=>typeof line.id==='string'&&line.id.length>0),'Every prepared line has a stable identity')
 assert.deepEqual(revision.totals,totals,'Revision retains the independently computed USD totals')
 assert.equal(revision.notes,notes)
 assert.equal(revision.approval,null,'A prepared revision carries no decision')
}

// Exact native estimate record, repair link, business event and audit entry for one preparation.
function assertEstimate(state,prior,target,row,step,priorEstimate){
 const expected=step==='prepare'?{n:1,lines:draftLines(),totals:draftTotals,notes:''}:{n:2,lines:revisedLines(),totals:revisedTotals,notes:revisedNotes}
 const revision=row.revisions.at(-1)
 assert.equal(row.jobId,target.id);assert.equal(row.status,'draft');assert.equal(row.authorisation,null)
 assert.equal(row.revisions.length,expected.n);assertRevision(revision,expected)
 if(step==='prepare'){
  assert.equal(row.version,1)
  assert.deepEqual(jobAt(state,target.id),{...jobAt(prior,target.id),version:target.version+1,estimateId:row.id},'Estimate preparation changes only the source version and estimate link')
 }else{
  assert.equal(row.version,priorEstimate.version+1)
  assert.deepEqual(row.revisions[0],priorEstimate.revisions[0],'Revision one stays exactly as prepared')
  assert.deepEqual(jobAt(state,target.id),jobAt(prior,target.id),'Estimate revision leaves the repair unchanged')
 }
 const command='estimate.'+step
 const events=rows(state,'event').filter(event=>event.jobId===target.id&&event.kind===command)
 assert.equal(events.length,1,'Exactly one matching native business event per preparation')
 assert.equal(events[0].subjectId,row.id);assert.deepEqual(events[0].actor,revision.preparedBy)
 assert.deepEqual(events[0].data,{revision:expected.n,totals:expected.totals},'The native business event cites the exact revision and totals')
 const audits=rows(state,'audit').filter(entry=>entry.action===command&&entry.changes.some(change=>change.kind==='estimate'&&change.id===row.id))
 assert.equal(audits.length,1,'Exactly one matching native audit entry per preparation')
 assert.deepEqual(audits[0].actor,revision.preparedBy)
 assert.equal(rows(state,'approval').filter(approval=>approval.subjectId===row.id&&approval.revision===expected.n).length,0,'Preparation grants no native decision on the prepared revision')
 assert.deepEqual(rows(state,'approval'),rows(prior,'approval'),'Preparation adds no decision anywhere')
}

/** Compare the MCP estimate preparation with the owner's native form on the independent installation. */
export function estimateParity({step,result,after,before,nativeAfter,nativeBefore,job,nativeJob,sourceEstimate,nativeEstimate,assertAttribution}){
 const actual=rows(after,'estimate').find(row=>row.id===result.id)
 const native=step==='prepare'?rows(nativeAfter,'estimate').find(row=>row.jobId===nativeJob.id):rows(nativeAfter,'estimate').find(row=>row.id===nativeEstimate.id)
 assert.ok(actual&&native,'Both public doors persist the prepared estimate')
 assert.deepEqual(result,actual,'MCP result equals the persisted native estimate')
 assertEstimate(after,before,job,actual,step,sourceEstimate)
 assertEstimate(nativeAfter,nativeBefore,nativeJob,native,step,nativeEstimate)
 assertAttribution(actual.revisions.at(-1).preparedBy,after.actor)
 assert.deepEqual(native.revisions.at(-1).preparedBy,nativeAfter.actor,'The owner form retains person attribution')
 assert.notEqual(actual.revisions.at(-1).preparedBy.name,native.revisions.at(-1).preparedBy.name,'Agent-for-person and person attribution stay distinct')
 assert.deepEqual(actual.revisions.at(-1).lines.map(withoutId),native.revisions.at(-1).lines.map(withoutId),'The same priced and taxed lines after explicit identity mapping')
 return {actual,native}
}
