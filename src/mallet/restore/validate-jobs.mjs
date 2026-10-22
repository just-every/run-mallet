import { quote, refuse } from './validate-staged.mjs'

/** Archived actors are attribution, never destination provider authority.
 * Only private staged copies change; history and original payloads stay exact. */
export async function validateAndQuarantineJobs({db,tables}){
 if(!tables.mallet_jobs)return
 const jobs=quote(tables.mallet_jobs),records=tables.mallet_records?quote(tables.mallet_records):null
 const reject=async(code,sql)=>{if(await db.prepare(`SELECT 1 FROM (${sql}) LIMIT 1`).first())refuse('jobs_'+code)}
 await reject('json',`SELECT 1 FROM ${jobs} WHERE NOT json_valid(payload) OR (outcome IS NOT NULL AND NOT json_valid(outcome))`)
 await reject('shape',`SELECT 1 FROM ${jobs} WHERE length(trim(id))=0 OR length(id)>100 OR kind NOT IN ('approval-reminder','stripe-payment-check') OR status NOT IN ('pending','leased','dispatching','succeeded','failed','uncertain','resolved') OR json_type(payload) IS NOT 'object' OR attempts<0 OR attempts>9007199254740991 OR typeof(attempts)<>'integer' OR typeof(due_at)<>'integer' OR typeof(created_at)<>'integer' OR typeof(updated_at)<>'integer'`)
 await reject('reminder_payload',`SELECT 1 FROM ${jobs} WHERE kind='approval-reminder' AND (
  (SELECT count(*) FROM json_each(payload))<>4 OR EXISTS(SELECT 1 FROM json_each(payload) WHERE key NOT IN ('chaseId','step','linkId','jobId'))
  OR json_type(payload,'$.chaseId') IS NOT 'text' OR json_type(payload,'$.jobId') IS NOT 'text' OR json_type(payload,'$.linkId') IS NOT 'text'
  OR json_type(payload,'$.step') IS NOT 'integer' OR json_extract(payload,'$.step') NOT BETWEEN 1 AND 10
  OR event_key IS NOT 'approval-reminder:'||json_extract(payload,'$.chaseId')||':'||json_extract(payload,'$.step'))`)
 await reject('payment_payload',`SELECT 1 FROM ${jobs} WHERE kind='stripe-payment-check' AND (
  (SELECT count(*) FROM json_each(payload))<>5 OR EXISTS(SELECT 1 FROM json_each(payload) WHERE key NOT IN ('invoiceId','version','paymentIntentId','requestedBy','consentEvidence'))
  OR json_type(payload,'$.invoiceId') IS NOT 'text' OR json_type(payload,'$.version') IS NOT 'integer' OR json_extract(payload,'$.version')<1
  OR json_type(payload,'$.paymentIntentId') IS NOT 'text' OR json_type(payload,'$.consentEvidence') IS NOT 'text' OR length(trim(json_extract(payload,'$.consentEvidence')))=0
  OR json_type(payload,'$.requestedBy') IS NOT 'object' OR json_type(payload,'$.requestedBy.id') IS NOT 'text' OR json_type(payload,'$.requestedBy.name') IS NOT 'text' OR json_type(payload,'$.requestedBy.version') IS NOT 'integer' OR json_extract(payload,'$.requestedBy.version')<1
  OR event_key NOT LIKE 'stripe-payment-check:%')`)
 if(records){
  await reject('reminder_reference',`SELECT 1 FROM ${jobs} j WHERE kind='approval-reminder' AND NOT EXISTS(
   SELECT 1 FROM ${records} c JOIN ${records} l ON l.kind='approvalLink' AND l.id=json_extract(j.payload,'$.linkId')
   JOIN ${records} r ON r.kind='job' AND r.id=json_extract(j.payload,'$.jobId')
   WHERE c.kind='approvalChase' AND c.id=json_extract(j.payload,'$.chaseId') AND json_extract(c.value,'$.jobId')=r.id AND json_extract(c.value,'$.linkId')=l.id AND json_extract(l.value,'$.jobId')=r.id)`)
  await reject('payment_reference',`SELECT 1 FROM ${jobs} j WHERE kind='stripe-payment-check' AND NOT EXISTS(SELECT 1 FROM ${records} r WHERE r.kind='invoice' AND r.id=json_extract(j.payload,'$.invoiceId'))`)
 }else await reject('missing_records',`SELECT 1 FROM ${jobs}`)
 if(tables.mallet_job_recoveries){
  const recoveries=quote(tables.mallet_job_recoveries)
  await reject('recovery',`SELECT 1 FROM ${recoveries} r WHERE action NOT IN ('replay','resolve') OR NOT json_valid(actor_json) OR NOT EXISTS(SELECT 1 FROM ${jobs} j WHERE j.id=r.job_id)`)
 }
 // Possible provider handoffs require human inspection. Even a never-sent
 // payment GET requires a fresh destination owner's explicit reapproval:
 // an untrusted archive can name that owner's ID, so ID freshness alone is
 // insufficient. Scoped reminder tokens are excluded from native archives.
 await db.prepare(`UPDATE ${jobs} SET status=CASE
  WHEN status='dispatching' OR (kind='stripe-payment-check' AND status IN ('pending','leased')) THEN 'uncertain'
  WHEN status='leased' THEN 'pending' ELSE status END,
  outcome=CASE WHEN status='dispatching' OR (kind='stripe-payment-check' AND status IN ('pending','leased')) THEN ? ELSE outcome END,
  lease_token=NULL,lease_until=NULL`).bind(JSON.stringify({status:'uncertain',provider:'restore',providerMessageId:null})).run()
 return true
}
