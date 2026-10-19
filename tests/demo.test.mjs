import {test} from 'node:test'
import assert from 'node:assert/strict'
import {run} from './harness.mjs'

const demo={entry:'tests/demo-worker.ts',bindings:{RER_DEMO:'1'}}
const count=(list,key)=>list.reduce((n,x)=>({...n,[x[key]]:(n[x[key]]??0)+1}),{})

test('QUALITY-001: demo opens on a lived-in workshop whose prepared work a person can decide, and sends nothing',()=>run(async h=>{
 const s=await h.state()
 assert.equal(s.actor.name,'Kayla Ortiz')
 const jobs=s.records.job,estimates=s.records.estimate,status=count(jobs,'status')
 for(const state of ['booked','working','completed','invoiced'])assert.ok(status[state]>0,state)
 for(const state of ['draft','sent','authorised'])assert.ok(count(estimates,'status')[state]>0,state)
 for(const job of jobs.filter(j=>['completed','invoiced'].includes(j.status))){
  const q=s.records.quality.find(q=>q.jobId===job.id);assert.ok(q,'Demo completion uses the same quality gate')
  const technician=q.signoffs.find(x=>x.kind==='technician'),reviewer=q.signoffs.find(x=>x.kind==='quality')
  assert.equal(technician.by.id,job.technicianId);assert.notEqual(reviewer.by.id,technician.by.id);assert.equal(reviewer.safetyDecision,'safe');assert.ok(q.results.every(r=>r.outcome==='pass'))
 }
 assert.ok(s.records.asset.length>=20)
 assert.ok(estimates.some(e=>e.authorisation&&e.authorisation.lineIds.length<e.revisions.at(-1).lines.length),'a partial customer authorisation')
 assert.ok(s.records.asset.some(a=>!a.visits.length),'an unused asset')
 // The assistant's draft estimate and its waiting-on-parts dispatch plan approve as the owner.
 const draft=estimates.find(e=>e.status==='draft'&&e.revisions[0].preparedBy.role==='agent')
 assert.equal((await h.command('estimate.approve',{estimateId:draft.id,version:draft.version,revision:1})).status,'approved')
 const pending=s.records.proposal.filter(p=>p.status==='pending');assert.equal(pending.length,1)
 for(const p of pending)assert.equal((await h.command('dispatch.approve',{proposalId:p.id,version:p.version})).status,'approved')
 // The approved invoice waiting for pickup exports once.
 const invoice=s.records.invoice.find(i=>i.status==='approved')
 assert.match((await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})).csv,/Battery|battery/)
 // Inviting a technician is accepted, and nothing reaches the mail provider.
 const invited=await h.api('/auth/invite',{email:'jamie@buckeyeauto.example',role:'member',displayName:'Jamie Cole',returnTo:'/app'},{status:202})
 assert.equal(invited.status,'accepted');assert.equal(h.messages.length,0)
 // A repeat seed writes nothing new.
 const again=await h.state();assert.equal(again.records.job.length,jobs.length)
 const page=await h.request('/app'),html=await page.text()
 assert.equal(page.status,200);assert.equal(html.match(/<[a-z]+[^>]*\sdata-rer-name[\s>=]/g).length,1);assert.ok(!html.includes('Demo Demo'))
 assert.match(html,/<title>Shop Board · Mallet Demo<\/title>/)
},demo))
