// The existing fictional demo shop follows the real clearance commands too.
// These records stay inside the explicitly labelled, isolated demo installation.
import type { Row } from '../model'
import type { Who } from './people'
type Run = (who: Who, command: string, payload: any, at: number) => Row
const MIN = 60000
export function beginDemoQuality(run: Run, job: Row, tech: Who, at: number): Row {
 let q = run('ben', 'quality.configure', { jobId: job.id, version: job.version, qualityVersion: 0, reason: 'Fictional demo repair: pre/post clearance scenario', items: [
  { label: 'Pre-work condition', stage: 'pre', required: true, critical: false },
  { label: 'Post-work repair function', stage: 'post', required: true, critical: true },
 ] }, at - 2 * MIN)
 q = run(tech, 'quality.record', { jobId: job.id, version: job.version, qualityVersion: q.version, itemId: q.revisions[0].items[0].id, outcome: 'pass', note: 'Demo scenario: technician records the intake condition before work.' }, at - MIN)
 return q
}
export function finishDemoQuality(run: Run, job: Row, tech: Who, q: Row, at: number): void {
 const input = () => ({ jobId: job.id, version: job.version, qualityVersion: q.version })
 q = run(tech, 'quality.record', { ...input(), itemId: q.revisions[0].items[1].id, outcome: 'pass', note: 'Demo scenario: technician verifies the completed repair function.' }, at - 3 * MIN)
 q = run(tech, 'quality.signTechnician', { ...input(), qualification: 'Fictional qualified technician in this demo scenario', note: 'Demo scenario: personally reviewed the current work and checks.' }, at - 2 * MIN)
 run('ben', 'quality.signQuality', { ...input(), qualification: 'Fictional independent qualified reviewer in this demo scenario', note: 'Demo scenario: independent review of current checks and work.', safetyDecision: 'safe' }, at - MIN)
}
