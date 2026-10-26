/** Review capabilities live outside archives; only attributed business history is portable. */
export async function validateReviews({table,rejectIf}){
 const records=table('mallet_records');if(!records)return
 const j=(field,alias='r')=>`json_extract(${alias}.value,'$.${field}')`
 const type=field=>`json_type(r.value,'$.${field}')`
 const check=(kind,code,condition)=>rejectIf('review_'+code,`SELECT 1 FROM ${records} r WHERE r.kind='${kind}' AND (${condition})`)
 for(const kind of ['reviewConsent','reviewRequest']){
  await check(kind,'scope',`NOT EXISTS(SELECT 1 FROM ${records} h WHERE h.kind='handover' AND h.id=${j('handoverId')} AND ${j('jobId','h')}=${j('jobId')} AND ${j('assetId','h')}=${j('assetId')})`)
  await check(kind,'actor',`${type('by')} IS NOT 'object' OR ${j('by.role')} IS NOT 'owner' OR ${type('by.id')} IS NOT 'text' OR julianday(${j('at')}) IS NULL`)
 }
 await check('reviewConsent','permission',`${j('purpose')} IS NOT 'review' OR ${type('to')} IS NOT 'text' OR length(${j('to')})>254 OR ${type('wording')} IS NOT 'text' OR length(trim(${j('wording')}))=0 OR ${type('wordingVersion')} IS NOT 'text' OR julianday(${j('consentedAt')}) IS NULL OR ${j('captureChannel')} NOT IN ('customer-form','customer-email','telephone','in-person') OR ${type('sourceEvidence')} IS NOT 'text' OR length(trim(${j('sourceEvidence')}))=0`)
 await check('reviewRequest','consent',`NOT EXISTS(SELECT 1 FROM ${records} c WHERE c.kind='reviewConsent' AND c.id=${j('consentId')} AND ${j('jobId','c')}=${j('jobId')} AND ${j('handoverId','c')}=${j('handoverId')} AND ${j('to','c')}=${j('to')})`)
 await check('reviewRequest','request',`${j('status')} NOT IN ('claimed','accepted','development','failed','uncertain') OR ${type('content')} IS NOT 'text' OR length(trim(${j('content')}))=0 OR ${type('reviewUrl')} IS NOT 'text' OR ${type('templateVersion')} IS NOT 'text' OR julianday(${j('expiresAt')}) IS NULL`)
 const googleHosts=['google.com','www.google.com','maps.google.com','search.google.com','g.page','maps.app.goo.gl']
 await check('reviewRequest','google_link','NOT ('+googleHosts.map(host=>`${j('reviewUrl')} LIKE 'https://${host}/%'`).join(' OR ')+')')
 await rejectIf('review_once',`SELECT 1 FROM ${records} WHERE kind='reviewRequest' GROUP BY json_extract(value,'$.handoverId') HAVING count(*)>1`)
 await check('reviewRequest','response',`${type('response')} IS NOT NULL AND (${type('response')} IS NOT 'object' OR julianday(${j('response.at')}) IS NULL OR (${j('response.erasedAt')} IS NULL AND (${type('response.rating')} IS NOT 'integer' OR ${j('response.rating')} NOT BETWEEN 1 AND 5 OR ${type('response.feedback')} IS NOT 'text' OR length(${j('response.feedback')})>2000)))`)
 await check('reviewRequest','task',`${j('taskId')} IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${records} t WHERE t.kind='subtask' AND t.id=${j('taskId')} AND ${j('reviewRequestId','t')}=r.id AND ${j('kind','t')}='review-feedback' AND ${j('jobId','t')}=${j('jobId')})`)
}
