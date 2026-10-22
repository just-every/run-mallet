/** Business history only: no live lease fencing or customer-link credentials. */
export async function customerJobHistory(db:D1Database,jobIds:Set<string>,invoiceIds:Set<string>){
 const jobs=(await db.prepare(`SELECT id,event_key,kind,payload,due_at,status,attempts,dispatched_at,outcome,projected_at,created_at,updated_at FROM mallet_jobs
 WHERE (kind='approval-reminder' AND json_extract(payload,'$.jobId') IN (SELECT value FROM json_each(?)))
 OR (kind='stripe-payment-check' AND json_extract(payload,'$.invoiceId') IN (SELECT value FROM json_each(?))) ORDER BY created_at,id`).bind(JSON.stringify([...jobIds]),JSON.stringify([...invoiceIds])).all<any>()).results.map(j=>({...j,payload:JSON.parse(j.payload),outcome:j.outcome?JSON.parse(j.outcome):null}))
 const recoveries=(await db.prepare('SELECT id,job_id,action,actor_json,reason,previous_outcome,previous_attempts,at FROM mallet_job_recoveries WHERE job_id IN (SELECT value FROM json_each(?)) ORDER BY at,id').bind(JSON.stringify(jobs.map(j=>j.id))).all<any>()).results.map(r=>{const {actor_json,previous_outcome,...rest}=r;return {...rest,actor:JSON.parse(actor_json),previousOutcome:previous_outcome?JSON.parse(previous_outcome):null}})
 return {jobs,recoveries}
}
