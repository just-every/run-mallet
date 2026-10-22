import {LEASE_MS,MAX_CONCURRENCY,view,type Handler,type Job,type Outcome} from './types'

/** Unsent reservations recover automatically. A possible external handoff always needs human inspection. */
export async function recoverExpiredLeases(db:D1Database,now=Date.now()) {
 await db.batch([
  db.prepare("UPDATE mallet_jobs SET status='pending',lease_token=NULL,lease_until=NULL,updated_at=? WHERE status='leased' AND lease_until<=?").bind(now,now),
  db.prepare("UPDATE mallet_jobs SET status='uncertain',lease_token=NULL,lease_until=NULL,outcome=?,updated_at=? WHERE status='dispatching' AND lease_until<=?").bind(JSON.stringify({status:'uncertain',provider:'unknown',providerMessageId:null}),now,now)
 ])
}
/** A single atomic claim enforces installation-wide concurrency, including overlapping cron invocations. */
export async function claimDueJobs(db:D1Database,now=Date.now()) {
 await recoverExpiredLeases(db,now)
 const token=crypto.randomUUID()
 const result=await db.prepare(`UPDATE mallet_jobs SET status='leased',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE id IN (
 SELECT id FROM mallet_jobs WHERE status='pending' AND due_at<=? ORDER BY due_at,id
 LIMIT MAX(0,?-(SELECT COUNT(*) FROM mallet_jobs WHERE status IN ('leased','dispatching')))
 ) AND status='pending' RETURNING *`).bind(token,now+LEASE_MS,now,now,MAX_CONCURRENCY).all<Job>()
 return result.results
}
/** No retries after provider handoff; handler implementations must validate current consent before sending. */
export async function runDueJobs(db:D1Database,handler:Handler,now=Date.now()) {
 const claims=await claimDueJobs(db,now)
 return Promise.all(claims.map(async row=>{
  const started=await db.prepare("UPDATE mallet_jobs SET status='dispatching',dispatched_at=?,updated_at=? WHERE id=? AND status='leased' AND lease_token=? AND lease_until>? RETURNING id").bind(now,now,row.id,row.lease_token,now).first()
  if(!started)return null
  let outcome:Outcome
  try{outcome=await handler(view({...row,status:'dispatching',dispatched_at:now}));if(!outcome||!['accepted','development','rejected','rate_limited','unavailable','uncertain','skipped'].includes(outcome.status)||typeof outcome.provider!=='string'||outcome.provider.length>100||outcome.providerMessageId!==null&&(typeof outcome.providerMessageId!=='string'||outcome.providerMessageId.length>300))throw Error('Invalid outcome')}
  catch{outcome={status:'uncertain',provider:'unknown',providerMessageId:null}}
  // Explicit allowlist prevents a handler accidentally retaining tokens or full provider responses.
  const saved={status:outcome.status,provider:outcome.provider,providerMessageId:outcome.providerMessageId}
  const status=outcome.status==='uncertain'?'uncertain':['accepted','development','skipped'].includes(outcome.status)?'succeeded':'failed'
  const recorded=await db.prepare("UPDATE mallet_jobs SET status=?,outcome=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND status='dispatching' AND lease_token=? RETURNING id").bind(status,JSON.stringify(saved),now,row.id,row.lease_token).first()
  if(!recorded)return null
  return {id:row.id,status,outcome:saved}
 }))
}
