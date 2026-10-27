/** Status history is portable; fresh local authority is intentionally absent after restore. */
export async function validateStatusNotices({table,rejectIf}){
 const records=table('mallet_records');if(!records)return
 const j=(field,alias='r')=>`json_extract(${alias}.value,'$.${field}')`,type=field=>`json_type(r.value,'$.${field}')`
 const check=(kind,code,condition)=>rejectIf('status_notice_'+code,`SELECT 1 FROM ${records} r WHERE r.kind='${kind}' AND (${condition})`)
 for(const kind of ['statusConsent','statusNotice']){
  await check(kind,'scope',`NOT EXISTS(SELECT 1 FROM ${records} a WHERE a.kind='asset' AND a.id=${j('assetId')}) OR NOT EXISTS(SELECT 1 FROM ${records} b WHERE b.kind='job' AND b.id=${j('jobId')} AND ${j('assetId','b')}=${j('assetId')})`)
  await check(kind,'actor',`${j('by.role')} IS NOT 'owner' OR ${type('by.id')} IS NOT 'text' OR julianday(${j('at')}) IS NULL OR ${type('to')} IS NOT 'text' OR length(${j('to')})>254 OR ${j('channel')} IS NOT 'email'`)
 }
 await check('statusConsent','permission',`${j('purpose')} IS NOT 'repair-status' OR ${type('wording')} IS NOT 'text' OR length(trim(${j('wording')}))=0 OR ${type('wordingVersion')} IS NOT 'text' OR julianday(${j('consentedAt')}) IS NULL OR ${j('captureChannel')} NOT IN ('customer-form','customer-email','telephone','in-person') OR ${type('sourceEvidence')} IS NOT 'text' OR length(trim(${j('sourceEvidence')}))=0`)
 await check('statusNotice','consent',`NOT EXISTS(SELECT 1 FROM ${records} c WHERE c.kind='statusConsent' AND c.id=${j('consentId')} AND ${j('jobId','c')}=${j('jobId')} AND ${j('to','c')}=${j('to')})`)
 await check('statusNotice','source',`NOT EXISTS(SELECT 1 FROM ${records} c WHERE c.kind='stageEvent' AND c.id=${j('sourceId')} AND ${j('jobId','c')}=${j('jobId')})`)
 await check('statusNotice','shape',`${j('kind')} NOT IN ('diagnosis','approval','parts','ready','pickup') OR ${j('status')} NOT IN ('pending','claimed','stopped','accepted','development','failed','uncertain','skipped') OR ${type('content')} IS NOT 'text' OR ${type('templateVersion')} IS NOT 'text' OR ${type('basis')} IS NOT 'text' OR ${type('jobVersion')} IS NOT 'integer' OR ${type('assetVersion')} IS NOT 'integer' OR ${type('consentVersion')} IS NOT 'integer' OR ${type('timeZone')} IS NOT 'text' OR ${type('allowedStart')} IS NOT 'integer' OR ${j('allowedStart')} NOT BETWEEN 0 AND 23 OR ${type('allowedEnd')} IS NOT 'integer' OR ${j('allowedEnd')} NOT BETWEEN 0 AND 23 OR ${j('allowedStart')}=${j('allowedEnd')} OR julianday(${j('dueAt')}) IS NULL OR julianday(${j('expiresAt')}) IS NULL OR ${j('dueAt')}>=${j('expiresAt')}`)
 await check('statusNotice','pickup_task',`${j('uncollectedTaskId')} IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${records} t WHERE t.kind='subtask' AND t.id=${j('uncollectedTaskId')} AND ${j('jobId','t')}=${j('jobId')} AND ${j('noticeId','t')}=r.id AND ${j('kind','t')}='pickup-followup')`)
 await rejectIf('status_notice_once',`SELECT 1 FROM ${records} WHERE kind='statusNotice' GROUP BY json_extract(value,'$.sourceId'),json_extract(value,'$.kind') HAVING count(*)>1`)
}
