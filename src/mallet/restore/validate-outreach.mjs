/** Consent history is portable; the separate installation authority table is not. */
export async function validateOutreach({table,rejectIf}){
 const records=table('mallet_records');if(!records)return
 const j=(field,alias='r')=>`json_extract(${alias}.value,'$.${field}')`
 const type=field=>`json_type(r.value,'$.${field}')`
 const check=(kind,code,condition)=>rejectIf('outreach_'+code,`SELECT 1 FROM ${records} r WHERE kind='${kind}' AND (${condition})`)
 const appointment=`EXISTS(SELECT 1 FROM ${records} a WHERE a.kind='appointment' AND a.id=${j('subjectId')})`
 await check('outreachConsent','consent_shape',`NOT ${appointment} OR ${j('channel')} IS NOT 'email' OR ${j('purpose')} NOT IN ('appointment-reminder','appointment-confirmation') OR ${j('wordingVersion')} IS NOT 'appointment-permission-v1' OR ${type('wording')} IS NOT 'text' OR ${type('customerName')} IS NOT 'text' OR ${type('to')} IS NOT 'text' OR ${j('by.role')} IS NOT 'owner' OR ${type('sourceEvidence')} IS NOT 'text' OR ${j('captureChannel')} NOT IN ('customer-form','customer-email','telephone','in-person') OR julianday(${j('consentedAt')}) IS NULL OR julianday(${j('at')}) IS NULL`)
 await check('outreachSuppression','suppression_shape',`NOT ${appointment} OR ${type('recipientHash')} IS NOT 'text' OR length(${j('recipientHash')})<>64 OR ${type('by.id')} IS NOT 'text' OR julianday(${j('at')}) IS NULL`)
 await check('outreach','approval_scope',`${j('templateVersion')} IS NOT NULL AND (
 ${j('kind')} IS NOT 'appointment' OR ${j('templateVersion')} IS NOT 'appointment-email-v2' OR ${type('source')} IS NOT 'object' OR ${type('content')} IS NOT 'text' OR
 NOT EXISTS(SELECT 1 FROM ${records} c WHERE c.kind='outreachConsent' AND c.id=${j('consentId')} AND ${j('subjectId','c')}=${j('subjectId')} AND ${j('purpose','c')}='appointment-reminder' AND ${j('version','c')}>=${j('consentVersion')}) OR
 (${j('status')} NOT IN ('draft','stopped') AND (${j('approval.by.role')} IS NOT 'owner' OR julianday(${j('approval.at')}) IS NULL))
 )`)
}
