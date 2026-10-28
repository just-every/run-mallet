import assert from 'node:assert/strict'

/** Continue through the existing work and quality forms from the prepared step. */
export async function blockerBrowserFollowThrough({h,p,advisor,job,form,submit,shot}){
 const jobPath='/app/jobs/'+job.id,blockerPath=jobPath+'/blockers'
 const observe=async()=>{await h.cron(new Date().toISOString());await p.goto(h.origin+blockerPath);return h.api(`/api/mallet/repairs/${job.id}/blockers`)}
 let v=await observe()
 assert.equal(v.current.nextAction.command,'work.record')
 await shot('14-prepared-authorized-work')
 while(v.current.nextAction?.command==='work.record'){
  const a=v.current.nextAction
  await p.getByRole('link',{name:a.label,exact:true}).first().click();await p.waitForLoadState('domcontentloaded')
  const work=form(p,'work.record').filter({has:p.locator(`input[name="estimateId"][value="${a.input.estimateId}"]`)})
  await work.locator('[name="lineId"]').selectOption(a.input.lineId)
  await work.locator('[name="quantity"]').fill(String(a.remainingQuantity))
  await work.locator('[name="note"]').fill('Technician performed the exact authorized remaining work')
  await submit(p,work,'Record parts or labor')
  v=await observe()
 }
 assert.equal(v.current.nextAction.command,'quality.configure')
 await shot('15-quality-still-required')
 await p.getByRole('link',{name:v.current.nextAction.label,exact:true}).first().click();await p.waitForLoadState('domcontentloaded')
 const checklist=form(p,'quality.configure')
 for(const [n,label] of ['Pre-work condition','Post-work function'].entries())await checklist.locator(`[name="qualityLabel${n}"]`).fill(label)
 await checklist.locator('[name="reason"]').fill('Qualified checks against the actual completed work')
 await submit(p,checklist,'Define checklist')
 let quality=(await h.state()).records.quality.find(q=>q.jobId===job.id)
 for(const item of quality.revisions.at(-1).items){
  const result=form(p,'quality.record').filter({has:p.locator(`input[name="itemId"][value="${item.id}"]`)})
  await result.locator('[name="outcome"]').selectOption('pass')
  await result.locator('[name="note"]').fill('Assigned technician physically inspected this result')
  await submit(p,result,'Record check')
 }
 v=await observe();assert.equal(v.current.nextAction.command,'quality.signTechnician')
 await p.getByRole('link',{name:v.current.nextAction.label,exact:true}).first().click();await p.waitForLoadState('domcontentloaded')
 const sign=form(p,'quality.signTechnician')
 await sign.locator('xpath=parent::details').locator(':scope > summary').click()
 await sign.locator('[name="qualification"]').fill('Qualified assigned technician')
 await sign.locator('[name="note"]').fill('Current physical work and observations inspected')
 await submit(p,sign,'Sign as assigned technician')
 v=await observe();assert.equal(v.current.nextAction.command,'quality.signQuality')
 await shot('16-independent-clearance-required')
 await advisor.goto(h.origin+jobPath)
 const independent=form(advisor,'quality.signQuality')
 await independent.locator('xpath=parent::details').locator(':scope > summary').click()
 await independent.locator('[name="qualification"]').fill('Qualified independent shop advisor')
 await independent.locator('[name="note"]').fill('Independent physical inspection of the current repair')
 await independent.locator('[name="safetyDecision"]').selectOption('safe')
 await submit(advisor,independent,'Sign independent quality decision')
 v=await observe();assert.equal(v.current.nextAction.command,'job.complete')
 assert.equal(v.current.progress.status,'working')
 await shot('17-explicit-completion-required')
 await p.getByRole('link',{name:v.current.nextAction.label,exact:true}).first().click();await p.waitForLoadState('domcontentloaded')
 await submit(p,form(p,'job.complete'),'Complete repair')
 v=await observe();assert.equal(v.current.nextAction,null);assert.equal(v.current.progress.status,'completed')
 await shot('18-actual-completed-repair')
}
