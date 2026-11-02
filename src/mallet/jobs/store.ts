import {MalletError} from '../model'
import {view,type Job,type ReminderPayload} from './types'

const validId=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=100&&!/[\u0000-\u001f]/.test(value)
/** Idempotency binds the business event to exact identifiers, independent of worker lifetime. */
export async function enqueueReminder(db:D1Database,payload:ReminderPayload,dueAt:number,now=Date.now()) {
 if(!payload||Object.keys(payload).sort().join(',')!=='chaseId,jobId,linkId,step'||![payload.chaseId,payload.jobId,payload.linkId].every(validId)||!Number.isSafeInteger(payload.step)||payload.step<1||payload.step>10||!Number.isSafeInteger(dueAt))throw new MalletError('JOB_INPUT','Supply exact reminder identifiers and due time.',400)
 const serialized=JSON.stringify({chaseId:payload.chaseId,step:payload.step,linkId:payload.linkId,jobId:payload.jobId}),key=`approval-reminder:${payload.chaseId}:${payload.step}`
 await db.prepare("INSERT OR IGNORE INTO mallet_jobs(id,event_key,kind,payload,due_at,status,created_at,updated_at) VALUES(?,?,'approval-reminder',?,?,'pending',?,?)").bind(crypto.randomUUID(),key,serialized,dueAt,now,now).run()
 const row=await db.prepare('SELECT * FROM mallet_jobs WHERE event_key=?').bind(key).first<Job>()
 if(!row||row.payload!==serialized||row.due_at!==dueAt)throw new MalletError('JOB_REPLAY','This business event already has different reminder identifiers or due time.',409)
 return view(row)
}
export async function readJob(db:D1Database,id:string){const row=await db.prepare('SELECT * FROM mallet_jobs WHERE id=?').bind(id).first<Job>();if(!row)throw new MalletError('NOT_FOUND','Background job unavailable.',404);return view(row)}
/** Bounded diagnostics; no mail addresses, tokens, bodies or credentials are retained. */
export async function jobDiagnostics(db:D1Database,now=Date.now()) {
 const results=await db.batch([
  db.prepare('SELECT status,COUNT(*) AS count,MIN(due_at) AS oldest_due_at FROM mallet_jobs GROUP BY status'),
  db.prepare("SELECT COUNT(*) AS count,MIN(due_at) AS oldest_due_at FROM mallet_jobs WHERE status='pending' AND due_at<=?").bind(now),
  db.prepare('SELECT * FROM mallet_jobs ORDER BY updated_at DESC,id LIMIT 50'),
  db.prepare('SELECT * FROM mallet_job_recoveries ORDER BY at DESC,id LIMIT 50')
 ])
 return {at:now,counts:results[0].results,due:results[1].results[0],jobs:(results[2].results as Job[]).map(view),recoveries:results[3].results}
}
