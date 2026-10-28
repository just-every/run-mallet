import {validateStatusNotices} from './validate-status-notices.mjs'
import {validateReviews} from './validate-reviews.mjs'
// Persisted kinds, including legacy shapes. Fields introduced later remain
// optional, but when present their references must name real product records.
const kinds = `storageRule storageCase assistantGrant assistantIntake assistantEdit assistantSend assistantEscalation webhookSubscription webhookDelivery statusConsent statusNotice reviewConsent reviewRequest outreach stripeReturn stripeReaderAction stripeConnection stripeCheckout stripeEvent stripeSettlement reportDelivery reportFilter audit taxCreditBasis tenderClearance arTerms arInvoice arDispute arPromise arReminder deposit appointment approval approvalChase approvalLink asset bookingService bookingWaitlist calendarAbsence calendarResource calendarSeries calendarTechnician chaseOptOut chasePolicy chaseTask contact counterIntake creditNote customerAccount customerBilling customerMerge declinedWork diagnosis diagnosticResult diagnosisLink diagnosisLinkView estimate event export flow handoff handover inspection inspectionJob inspectionReport inspectionReportDelivery inspectionTemplate intake intakeComparison intakeForm intakeSecretAudit intakeTemplate invoice invoiceDocument invoiceDelivery job jobNote costRate payRate payment pricingMatrix promise promiseNotice promisePlan promiseRevision promiseSettings proposal purchaseComparison purchaseSubmission purchaseBill purchaseOrder purchaseReceipt quality rateProfile reading refund retentionHold retentionPolicy retentionReceipt returnDelegate returnOverride routingBlocker routingCase routingPolicy serviceInterval specialPart specialPartNotice stageEvent stockTransfer stockTransferException stockRma stockCore stockSupplierCredit stockReplenishment stockBin stockCount stockItem stockLot stockLotAdjustment stockMovement stockReceipt stockReservation stockUse sublet subtask taxCertificate taxDiscountRule taxFeeRule taxJurisdiction taxSettings timeCorrection timeEntry waitlistOffer warranty warrantyTerms`.split(' ')
const sqlList = values => values.map(v => "'" + v.replaceAll("'", "''") + "'").join(',')
const j = (field, alias = 'r') => `json_extract(${alias}.value,'$.${field}')`
const type = field => `json_type(r.value,'$.${field}')`
const requiredText = fields => fields.map(field => `(${type(field)} IS NOT 'text' OR length(trim(${j(field)}))=0 OR length(${j(field)})>200)`).join(' OR ')

export async function validateRecords({ table, rejectIf, index }) {
 const records = table('mallet_records')
 if (!records) return
 await rejectIf('record_json', `SELECT 1 FROM ${records} WHERE NOT json_valid(value)`)
 await rejectIf('record_identity', `SELECT 1 FROM ${records} r WHERE json_type(value) IS NOT 'object' OR kind NOT IN (${sqlList(kinds)}) OR typeof(id)<>'text' OR length(trim(id))=0 OR typeof(revision)<>'integer' OR revision<1 OR revision>9007199254740991 OR ${type('id')} IS NOT 'text' OR ${j('id')}<>id OR ${type('version')} IS NOT 'integer' OR ${j('version')}<>revision`)
 await index('mallet_records', 'identity', 'kind,id', true)
 await index('mallet_records', 'job', "kind,json_extract(value,'$.jobId')")
 const check = (kind, code, condition) => rejectIf(code, `SELECT 1 FROM ${records} r WHERE r.kind IN (${sqlList(kind.split(' '))}) AND (${condition})`)
 const exists = (kind, value, extra = '') => `EXISTS(SELECT 1 FROM ${records} target WHERE target.kind='${kind}' AND target.id=${value} ${extra})`
 const reference = async (kind, field, target, required = false, extra = '') => {
  const value = j(field)
  await check(kind, field + '_reference', `(${required ? '1' : `${value} IS NOT NULL`}) AND (${type(field)} IS NOT 'text' OR NOT ${exists(target, value, extra)})`)
 }
 await check('webhookSubscription','webhook_subscription_shape',requiredText(['label','by.id','at'])+` OR ${type('consentEvidence')} IS NOT 'text' OR length(trim(${j('consentEvidence')}))=0 OR length(${j('consentEvidence')})>2000`+` OR ${type('active')} NOT IN ('true','false') OR ${type('families')} IS NOT 'array' OR json_array_length(r.value,'$.families')<1 OR EXISTS(SELECT 1 FROM json_each(r.value,'$.families') f WHERE f.value NOT IN ('booking','inspection','approval','parts','status','invoice','payment'))`)
 await reference('webhookDelivery','subscriptionId','webhookSubscription',true)
 await reference('webhookDelivery','eventId','event',true)
 await check('webhookDelivery','webhook_delivery_shape',`${j('status')} NOT IN ('pending','claimed','delivered','failed','uncertain','blocked') OR ${type('attempts')} IS NOT 'integer' OR ${j('attempts')}<0 OR ${type('cycleAttempts')} IS NOT 'integer' OR ${j('cycleAttempts')} NOT BETWEEN 0 AND 3 OR ${type('history')} IS NOT 'array' OR ${type('envelope')} IS NOT 'object' OR ${j('envelope.event_id')} IS NOT ${j('eventId')} OR ${j('envelope.input.schema_version')} IS NOT 1 OR julianday(${j('dueAt')}) IS NULL`)
 await rejectIf('webhook_delivery_unique',`SELECT 1 FROM ${records} WHERE kind='webhookDelivery' GROUP BY json_extract(value,'$.subscriptionId'),json_extract(value,'$.eventId') HAVING count(*)>1`)
 for(const kind of ['assistantIntake','assistantEdit','assistantSend','assistantEscalation'])await reference(kind,'grantId','assistantGrant',true)
 await reference('assistantIntake assistantSend','appointmentId','appointment',true)
 await reference('assistantEdit','diagnosisId','diagnosis',true)
 await reference('assistantEdit','jobId','job',true)
 await check('assistantGrant','assistant_grant_shape',requiredText(['kind','subjectId','label','policy'])+` OR ${j('kind')} NOT IN ('receptionist','polish','send') OR ${j('spendCents')} IS NOT 0 OR ${j('by.role')} IS NOT 'owner' OR julianday(${j('notBefore')}) IS NULL OR julianday(${j('expiresAt')}) IS NULL OR ${j('expiresAt')}<=${j('notBefore')}`)
 await check('assistantSend','assistant_send_shape',requiredText(['status'])+` OR ${type('to')} IS NOT 'text' OR length(${j('to')}) NOT BETWEEN 3 AND 254 OR ${type('content')} IS NOT 'text' OR length(${j('content')}) NOT BETWEEN 1 AND 4000`+` OR ${j('channel')} IS NOT 'email' OR ${j('spendCents')} IS NOT 0 OR ${j('status')} NOT IN ('queued','reviewed','claimed','accepted','development','failed','uncertain','stopped')`)
 await check('storageRule','storage_rule_shape',requiredText(['state','scope','at','by.id'])+` OR ${j('state')} NOT IN ('CA','TX') OR ${j('scope')} NOT IN ('vehicle','device') OR ${j('by.role')}<>'owner' OR ${type('catalog.sources')} IS NOT 'array' OR json_array_length(r.value,'$.catalog.sources')=0 OR ${type('review')} IS NOT 'text' OR length(trim(${j('review')}))=0 OR ${type('basis')} IS NOT 'text' OR length(trim(${j('basis')}))=0 OR ${type('method')} IS NOT 'text' OR length(trim(${j('method')}))=0 OR `+['dailyCents','capCents','graceHours','noticeDays','waitDays'].map(f=>`(${type(f)} IS NOT 'integer' OR ${j(f)}<0 OR ${j(f)}>100000000)`).join(' OR '))
 await check('storageCase','storage_case_shape',`${type('notices')} IS NOT 'array' OR ${type('reviews')} IS NOT 'array' OR julianday(${j('startsAt')}) IS NULL OR julianday(${j('noticeDueAt')}) IS NULL OR julianday(${j('notifiedAt')}) IS NULL OR ${type('repairCents')} IS NOT 'integer' OR ${j('repairCents')}<0 OR ${j('repairCents')}>1000000000 OR ${type('recipients')} IS NOT 'text' OR length(trim(${j('recipients')}))=0 OR NOT EXISTS(SELECT 1 FROM ${records} rule WHERE rule.kind='storageRule' AND rule.id=${j('rule.id')} AND json(rule.value)=json(${j('rule')})) OR EXISTS(SELECT 1 FROM json_each(r.value,'$.notices') n WHERE json_type(n.value,'$.evidence') IS NOT 'text' OR julianday(json_extract(n.value,'$.deliveredAt')) IS NULL OR julianday(json_extract(n.value,'$.eligibleAt')) IS NULL)`)
 await reference('storageCase','release.handoverId','handover')
 await check('storageCase','storage_release_shape',`${type('release')}='object' AND (julianday(${j('release.at')}) IS NULL OR ${type('release.balance.storageCents')} IS NOT 'integer' OR ${j('release.balance.storageCents')}<0 OR ${type('release.lienWaivedCents')} IS NOT 'integer' OR ${j('release.lienWaivedCents')}<0)`)
 await rejectIf('storage_case_unique',`SELECT 1 FROM ${records} WHERE kind='storageCase' GROUP BY json_extract(value,'$.jobId') HAVING count(*)>1`)
 await reference('storageCase','jobId','job',true)
 await reference('storageCase','invoiceId','invoice',true)
 await reference('storageCase','rule.id','storageRule',true)
 await validateReviews({table,rejectIf})
 await validateStatusNotices({table,rejectIf})
 await check('outreach','outreach_reference',`(${j('kind')}='balance' AND (NOT ${exists('invoice',j('subjectId'))} OR ${j('review.invoiceId')}<>${j('subjectId')} OR ${type('invoiceVersion')} IS NOT 'integer' OR ${type('content')} IS NOT 'text')) OR (${j('kind')}='appointment' AND NOT ${exists('appointment',j('subjectId'))}) OR (${j('kind')}='declined' AND (NOT ${exists('declinedWork',j('subjectId'))} OR NOT ${exists('estimate',j('estimateId'))}))`)
 await check('outreach','outreach_shape',requiredText(['subjectId','dueAt','expiresAt','timeZone','by.id'])+['to','consentEvidence','instructions'].map(field=>` OR ${type(field)} IS NOT 'text' OR length(trim(${j(field)}))=0 OR length(${j(field)})>${field==='to'?254:2000}`).join('')+` OR ${j('kind')} NOT IN ('appointment','declined','balance') OR ${j('status')} NOT IN ('pending','claimed','stopped','accepted','development','failed','uncertain','skipped') OR ${j('by.role')}<>'owner' OR typeof(${j('allowedStart')})<>'integer' OR ${j('allowedStart')} NOT BETWEEN 0 AND 23 OR typeof(${j('allowedEnd')})<>'integer' OR ${j('allowedEnd')} NOT BETWEEN 0 AND 23 OR ${j('allowedStart')}=${j('allowedEnd')} OR julianday(${j('dueAt')}) IS NULL OR julianday(${j('expiresAt')})<=julianday(${j('dueAt')})`)
 await check('reportFilter','report_filter_shape',requiredText(['ownerId','name','report','at'])+` OR ${j('report')} NOT IN ('technicians','turnaround') OR ${type('archived')} NOT IN ('true','false') OR julianday(${j('from')}) IS NULL OR julianday(${j('to')}) IS NULL OR ${j('from')}>${j('to')}`)
 await reference('reportDelivery','filterId','reportFilter',true)
 await check('reportDelivery','report_delivery_shape',requiredText(['ownerId','to','status','dueAt','consentAt','at'])+` OR ${j('status')} NOT IN ('unconfirmed','accepted','development','failed','uncertain') OR ${type('contentHash')} IS NOT 'text' OR length(${j('contentHash')})<>64 OR julianday(${j('dueAt')}) IS NULL`)
 await check('appointment','attendance_shape',`${j('attendance')} IS NOT NULL AND (${type('attendance')} IS NOT 'object' OR ${j('attendance.outcome')} NOT IN ('arrived','no-show') OR ${j('attendance.by.role')} IS NOT 'owner' OR ${type('attendance.evidence')} IS NOT 'text' OR length(trim(${j('attendance.evidence')}))=0 OR julianday(${j('attendance.at')}) IS NULL OR ${j('attendance.at')}<${j('startAt')})`)
 await check('appointment','attendance_corrections_shape',`${j('attendanceCorrections')} IS NOT NULL AND (
 ${type('attendanceCorrections')} IS NOT 'array' OR ${j('attendance')} IS NULL OR
 EXISTS(SELECT 1 FROM json_each(r.value,'$.attendanceCorrections') o WHERE
  o.type<>'object' OR json_type(o.value,'$.outcome') IS NOT 'text' OR json_extract(o.value,'$.outcome') NOT IN ('arrived','no-show') OR
  json_extract(o.value,'$.by.role') IS NOT 'owner' OR json_type(o.value,'$.evidence') IS NOT 'text' OR length(trim(json_extract(o.value,'$.evidence')))=0 OR length(json_extract(o.value,'$.evidence'))>2000 OR
  json_type(o.value,'$.reason') IS NOT 'text' OR length(trim(json_extract(o.value,'$.reason')))=0 OR length(json_extract(o.value,'$.reason'))>2000 OR
  julianday(json_extract(o.value,'$.at')) IS NULL OR julianday(json_extract(o.value,'$.at'))<julianday(${j('startAt')}) OR julianday(json_extract(o.value,'$.at'))<julianday(${j('attendance.at')}) OR
  EXISTS(SELECT 1 FROM json_each(r.value,'$.attendanceCorrections') prior WHERE CAST(prior.key AS INTEGER)<CAST(o.key AS INTEGER) AND julianday(json_extract(prior.value,'$.at'))>julianday(json_extract(o.value,'$.at')))
 ))`)

 await reference('invoiceDocument','snapshot.accountTerms.assignmentId','arInvoice')
 await check('audit','audit_shape',requiredText(['action','at','actor.id','actor.name','actor.role','policy'])+` OR ${type('changes')} IS NOT 'array' OR ${type('evidence')} IS NOT 'array' OR julianday(${j('at')}) IS NULL`)
 await reference('taxCreditBasis','creditNoteId','creditNote',true)
 await reference('taxCreditBasis','invoiceId','invoice',true)
 await rejectIf('tax_credit_basis_unique',`SELECT 1 FROM ${records} WHERE kind='taxCreditBasis' GROUP BY json_extract(value,'$.creditNoteId') HAVING count(*)>1`)
 await check('tenderClearance','clearance_shape',`${j('sourceKind')} NOT IN ('deposit','payment') OR julianday(${j('observedOn')}) IS NULL OR ${j('by.role')}<>'owner' OR NOT EXISTS(SELECT 1 FROM ${records} source WHERE source.kind=${j('sourceKind')} AND source.id=${j('sourceId')} AND json_extract(source.value,'$.method') IN ('check','other'))`)
 await rejectIf('clearance_unique',`SELECT 1 FROM ${records} WHERE kind='tenderClearance' GROUP BY json_extract(value,'$.sourceKind'),json_extract(value,'$.sourceId') HAVING count(*)>1`)
 await reference('arTerms arInvoice arDispute arPromise arReminder','accountId','customerAccount',true)
 await reference('arInvoice arDispute arPromise arReminder','invoiceId','invoice',true)
 await check('arTerms','ar_terms_shape',`${type('days')} IS NOT 'integer' OR ${j('days')}<1 OR ${j('days')}>365 OR ${type('limitCents')} IS NOT 'integer' OR ${j('limitCents')}<1 OR ${type('consent')} IS NOT 'true' OR ${type('active')} NOT IN ('true','false') OR ${j('by.role')}<>'owner'`)
 await check('arInvoice','ar_invoice_shape',`${type('terms')} IS NOT 'object' OR julianday(${j('dueOn')}) IS NULL OR NOT ${exists('arTerms',j('terms.id'))} OR ${j('by.role')}<>'owner'`)
 await check('arDispute','ar_dispute_shape',`${j('status')} NOT IN ('open','resolved') OR ${j('by.role')}<>'owner'`)
 await check('arPromise','ar_promise_shape',`${type('amountCents')} IS NOT 'integer' OR ${j('amountCents')}<1 OR julianday(${j('promisedOn')}) IS NULL OR ${j('by.role')}<>'owner'`)
 await rejectIf('ar_invoice_unique',`SELECT 1 FROM ${records} WHERE kind='arInvoice' GROUP BY json_extract(value,'$.invoiceId') HAVING count(*)>1`)
 await reference('deposit','accountId','customerAccount',true)
 await reference('deposit','jobId','job')
 await reference('payment','depositId','deposit')
 await check('taxFeeRule','supplies_fee_shape',requiredText(['name','basis'])+` OR (${j('category')} IS NOT NULL AND ${j('category')} NOT IN ('supplies','disposal','environmental','surcharge')) OR (${j('mode')} IS NOT NULL AND ${j('mode')} NOT IN ('percentage','fixed')) OR (${j('mode')}='fixed' AND (${type('fixedCents')} IS NOT 'integer' OR ${j('fixedCents')}<0 OR ${j('fixedCents')}>1000000000)) OR ${j('basis')} NOT IN ('parts','labor','parts and labor') OR ${type('rateBps')} IS NOT 'integer' OR ${j('rateBps')}<0 OR ${j('rateBps')}>10000 OR ${type('capCents')} IS NOT 'integer' OR ${j('capCents')}<0 OR ${j('capCents')}>1000000000 OR ${type('taxable')} NOT IN ('true','false')`)
 await check('taxDiscountRule','discount_rule_shape',requiredText(['name','basis'])+` OR ${type('legalBasis')} IS NOT 'text' OR length(trim(${j('legalBasis')}))=0 OR length(${j('legalBasis')})>2000 OR ${j('basis')} NOT IN ('parts','labor','parts and labor') OR ${type('rateBps')} IS NOT 'integer' OR ${j('rateBps')}<0 OR ${j('rateBps')}>10000`)
 await reference('taxCertificate','accountId','customerAccount',true)
 await reference('taxJurisdiction','invoiceId','invoice',true)
 await check('taxCertificate','certificate_shape',requiredText(['reference','jurisdiction','scope','validFrom','expiresOn'])+` OR ${type('certificate')} IS NOT 'text' OR ${j('scope')} NOT IN ('parts','labor','fees','all') OR julianday(${j('validFrom')}) IS NULL OR julianday(${j('expiresOn')})<julianday(${j('validFrom')})`)
 await rejectIf('invoice_jurisdiction_unique',`SELECT 1 FROM ${records} WHERE kind='taxJurisdiction' GROUP BY json_extract(value,'$.invoiceId') HAVING count(*)>1`)
 await rejectIf('invoice_document_sequence_unique',`SELECT 1 FROM ${records} WHERE kind='invoiceDocument' GROUP BY json_extract(value,'$.invoiceId'),json_extract(value,'$.sequence') HAVING count(*)>1`)
 await reference('invoiceDocument invoiceDelivery','invoiceId','invoice',true)
 await reference('invoiceDelivery','documentId','invoiceDocument',true)
 await reference('invoiceDocument','corrects','invoiceDocument')
 await check('invoiceDocument','invoice_document_shape',requiredText(['number','contentHash','pdfHash'])+` OR ${type('snapshot')} IS NOT 'object' OR ${type('content')} IS NOT 'text' OR ${type('pdfBase64')} IS NOT 'text'`)
 await check('asset', 'asset_shape', requiredText(['customerName', 'label', 'identifier']) + ` OR ${type('visits')} IS NOT 'array'`)
 await check('asset', 'asset_type', `${j('assetType')} IS NOT NULL AND (${type('assetType')} IS NOT 'text' OR ${j('assetType')} NOT IN ('vehicle','bicycle','equipment','device') OR ${type('specifications')} IS NOT 'object')`)
 await rejectIf('asset_identifier', `SELECT 1 FROM ${records} WHERE kind='asset' GROUP BY lower(json_extract(value,'$.identifier')) HAVING count(*)>1`)
 await check('asset', 'asset_visits', `EXISTS(SELECT 1 FROM json_each(r.value,'$.visits') visit WHERE visit.type<>'text' OR NOT ${exists('job', 'visit.value', `AND ${j('assetId','target')}=r.id`)}) OR EXISTS(SELECT 1 FROM json_each(r.value,'$.visits') GROUP BY value HAVING count(*)>1)`)
 await reference('asset', 'customerAccountId', 'customerAccount')
 await reference('asset', 'driverContactId', 'contact')
 await check('asset', 'asset_driver_scope', `${j('driverContactId')} IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${records} a,json_each(a.value,'$.contactIds') c WHERE a.kind='customerAccount' AND a.id=${j('customerAccountId')} AND c.value=${j('driverContactId')})`)
 await check('job', 'job_shape', requiredText(['assetId','title','technicianId','bayId','startAt','endAt','asset.customerName','asset.label','asset.identifier']) + ` OR ${type('asset')} IS NOT 'object' OR ${type('actuals')} IS NOT 'array' OR ${j('status')} NOT IN ('booked','working','completed','invoiced','canceled','lost') OR ${type('status')} IS NOT 'text' OR julianday(${j('startAt')}) IS NULL OR julianday(${j('endAt')}) IS NULL OR julianday(${j('endAt')})<=julianday(${j('startAt')})`)
 await check('job','job_actual_shape',`EXISTS(SELECT 1 FROM json_each(r.value,'$.actuals') a WHERE a.type<>'object') OR (${j('status')} IN ('working','completed','invoiced') AND json_array_length(r.value,'$.actuals')=0)`)
 await check('job','job_actual_quantity',`EXISTS(SELECT 1 FROM json_each(r.value,'$.actuals') a WHERE json_type(a.value,'$.quantityMilli') IS NOT 'integer' OR json_extract(a.value,'$.quantityMilli')<=0 OR json_extract(a.value,'$.quantityMilli')>9007199254740991)`)
 await reference('job', 'assetId', 'asset', true, `AND EXISTS(SELECT 1 FROM json_each(target.value,'$.visits') WHERE value=r.id)`)
 await reference('job', 'estimateId', 'estimate', false, `AND ${j('jobId','target')}=r.id`)
 await reference('job', 'invoiceId', 'invoice', false, `AND ${j('jobId','target')}=r.id`)
 await reference('invoice','jobId','job',true,`AND ${j('invoiceId','target')}=r.id`)
 await check('job', 'invoiced_job', `${j('status')}='invoiced' AND (${j('invoiceId')} IS NULL OR NOT ${exists('invoice', j('invoiceId'), `AND ${j('status','target')}='exported'`)})`)
 // No requirement for customerAccountId on assets: older native/imported
 // registers legitimately only hold their customer snapshot.
 await check('contact', 'contact_shape', requiredText(['name']) + ` OR (${type('email')} IS NOT 'text') OR (${type('phone')} IS NOT 'text') OR length(${j('phone')})>100 OR length(${j('email')})>254`)
 await check('customerAccount', 'account_shape', requiredText(['name']) + ` OR ${type('kind')} IS NOT 'text' OR ${j('kind')} NOT IN ('person','household','business','fleet') OR ${type('contactIds')} IS NOT 'array' OR json_array_length(r.value,'$.contactIds')<1`)
 await check('customerAccount', 'account_contacts', `EXISTS(SELECT 1 FROM json_each(r.value,'$.contactIds') c WHERE c.type<>'text' OR NOT ${exists('contact','c.value')}) OR EXISTS(SELECT 1 FROM json_each(r.value,'$.contactIds') GROUP BY value HAVING count(*)>1)`)
 for (const field of ['payerId','billingContactId','driverId','authorizerId']) await check('customerAccount', 'account_role', `(${['payerId','billingContactId'].includes(field) ? '1' : `${j(field)} IS NOT NULL`}) AND (${type(field)} IS NOT 'text' OR NOT EXISTS(SELECT 1 FROM json_each(r.value,'$.contactIds') WHERE value=${j(field)}))`)
 await reference('customerAccount', 'mergedInto', 'customerAccount', false, `AND target.id<>r.id AND ${j('mergedInto','target')} IS NULL`)
 const jobKinds = 'statusConsent statusNotice reviewConsent reviewRequest stripeReturn stripeReaderAction stripeCheckout stripeEvent stripeSettlement approvalChase approvalLink chaseTask customerBilling declinedWork diagnosis diagnosticResult diagnosisLink estimate flow handoff handover inspection inspectionReport inspectionReportDelivery intake intakeComparison intakeForm invoice jobNote payment promise promiseNotice promisePlan promiseRevision proposal quality reading returnDelegate returnOverride routingBlocker routingCase serviceInterval specialPart specialPartNotice stageEvent stockReservation stockUse sublet subtask warranty warrantyTerms'
 for (const kind of jobKinds.split(' ')) await reference(kind, 'jobId', 'job', true)
 for (const kind of ['purchaseComparison','purchaseSubmission','stockRma','event','counterIntake','retentionHold','timeEntry','timeCorrection']) await reference(kind,'jobId','job')
 for (const [kind, field, target] of [
  ['estimate','supplementOf','estimate'], ['invoice','exportId','export'], ['export','invoiceId','invoice'],
  ['payment creditNote refund returnOverride handover','invoiceId','invoice'], ['refund','paymentId','payment'],
  ['intakeComparison','intakeId','intake'], ['intakeForm counterIntake','templateId','intakeTemplate'],
  ['inspectionReportDelivery','reportId','inspectionReport'], ['approvalLink approvalChase chaseTask declinedWork specialPart stockUse','estimateId','estimate'], ['timeCorrection','entryId','timeEntry'],
  ['stockMovement stockReservation stockReceipt stockLot stockUse stockCount','itemId','stockItem'],
  ['stockMovement stockReservation stockReceipt stockLot stockUse stockCount','binId','stockBin'],
  ['purchaseComparison','itemId','stockItem'], ['purchaseSubmission','purchaseId','purchaseOrder'],
  ['stockTransfer','sourceBinId','stockBin'], ['stockTransfer','destinationBinId','stockBin'], ['stockTransferException','transferId','stockTransfer'], ['stockTransferException','lotId','stockLot'],
  ['stockRma','lotId','stockLot'], ['stockRma','purchaseId','purchaseOrder'], ['stockRma','purchaseReceiptId','purchaseReceipt'], ['stockRma','stockUseId','stockUse'], ['stockRma','warrantyId','warranty'],
  ['stockCore','jobId','job'], ['stockCore','invoiceId','invoice'], ['stockCore','stockUseId','stockUse'], ['stockCore','creditNoteId','creditNote'],
  ['stockReplenishment','itemId','stockItem'], ['stockReplenishment','binId','stockBin'],
  ['stockUse stockLotAdjustment','lotId','stockLot'], ['purchaseReceipt purchaseBill','purchaseId','purchaseOrder'],
  ['bookingWaitlist appointment','serviceId','bookingService'], ['waitlistOffer','entryId','bookingWaitlist'],
  ['waitlistOffer','appointmentId','appointment'], ['routingBlocker','caseId','routingCase']
 ]) await reference(kind,field,target,!['supplementOf','exportId','creditNoteId','warrantyId'].includes(field)&&!(kind==='stockRma'&&field==='stockUseId'))
 for (const [kind, allowed] of [ ['estimate',['draft','approved','sent','authorised','declined']], ['invoice',['draft','approved','exported']], ['proposal',['pending','approved']] ]) await check(kind,kind+'_status',`${type('status')} IS NOT 'text' OR ${j('status')} NOT IN (${sqlList(allowed)})`)
 await check('diagnosticResult','diagnostic_result_shape', requiredText(['sha256','adapter']) + ` OR ${type('raw')} IS NOT 'text' OR length(CAST(${j('raw')} AS BLOB))>65536 OR ${j('adapter')}<>'phonecheck-device-info' OR ${j('status')} NOT IN ('matched','quarantined') OR NOT json_valid(${j('raw')}) OR length(${j('sha256')})<>64`)
 await check('estimate','estimate_revisions',`${type('revisions')} IS NOT 'array' OR json_array_length(r.value,'$.revisions')<1 OR ${type('sent')} IS NOT 'array'`)
 await check('estimate','estimate_revision_shape',`EXISTS(SELECT 1 FROM json_each(r.value,'$.revisions') rev WHERE rev.type<>'object')`)
 await check('estimate','estimate_line_shape',`EXISTS(SELECT 1 FROM json_each(r.value,'$.revisions') rev WHERE json_type(rev.value,'$.lines') IS NOT 'array' OR json_type(rev.value,'$.n') IS NOT 'integer' OR EXISTS(SELECT 1 FROM json_each(rev.value,'$.lines') line WHERE line.type<>'object'))`)
 await check('estimate','estimate_decision_lines',`json_type(r.value,'$.authorisation')='object' AND EXISTS(SELECT 1 FROM json_each(r.value,'$.authorisation.lineIds') consent WHERE consent.type<>'text' OR NOT EXISTS(SELECT 1 FROM json_each(r.value,'$.revisions') rev,json_each(rev.value,'$.lines') line WHERE json_extract(rev.value,'$.n')=${j('authorisation.revision')} AND json_extract(line.value,'$.id')=consent.value))`)

 await check('estimate','estimate_approval',`${j('status')} IN ('approved','sent','authorised','declined') AND json_type(r.value,'$.revisions[#-1].approval') IS NOT 'object'`)
 await check('estimate','estimate_decision_revision',`json_type(r.value,'$.authorisation')='object' AND (${j('status')} NOT IN ('authorised','declined') OR ${j('authorisation.revision')} IS NOT json_extract(r.value,'$.revisions[#-1].n') OR (${j('status')}='authorised' AND json_array_length(r.value,'$.authorisation.lineIds')=0) OR (${j('status')}='declined' AND json_array_length(r.value,'$.authorisation.lineIds')<>0))`)
 // The archive retains consent, it cannot replace it with a status flag.
 await check('estimate','estimate_decision',`${j('status')} IN ('authorised','declined') AND (json_type(r.value,'$.authorisation') IS NOT 'object' OR json_type(r.value,'$.authorisation.lineIds') IS NOT 'array' OR NOT EXISTS(SELECT 1 FROM json_each(r.value,'$.revisions') rev WHERE json_extract(rev.value,'$.n')=${j('authorisation.revision')} AND json_type(rev.value,'$.approval')='object'))`)
 await check('invoice','invoice_export',`${j('status')}='exported' AND (${j('exportId')} IS NULL OR NOT ${exists('export',j('exportId'),`AND ${j('invoiceId','target')}=r.id`)})`)
 await check('invoice','invoice_approval',`${j('status')} IN ('approved','exported') AND ${type('approval')} IS NOT 'object'`)
 await check('job','actual_scope',`EXISTS(SELECT 1 FROM json_each(r.value,'$.actuals') a WHERE NOT EXISTS(SELECT 1 FROM ${records} e,json_each(e.value,'$.revisions') rev,json_each(rev.value,'$.lines') line,json_each(e.value,'$.authorisation.lineIds') consent WHERE e.kind='estimate' AND e.id=json_extract(a.value,'$.estimateId') AND ${j('jobId','e')}=r.id AND json_extract(rev.value,'$.n')=json_extract(a.value,'$.revision') AND json_extract(line.value,'$.id')=json_extract(a.value,'$.lineId') AND consent.value=json_extract(a.value,'$.lineId')))`)
 const meta=table('mallet_meta')
 if(meta) await rejectIf('meta', `SELECT 1 WHERE (SELECT count(*) FROM ${meta})<>1 OR NOT EXISTS(SELECT 1 FROM ${meta} WHERE id=1 AND typeof(version)='integer' AND version>=0 AND version<=9007199254740991)`)
}
