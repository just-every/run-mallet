// Persisted kinds, including legacy shapes. Fields introduced later remain
// optional, but when present their references must name real product records.
const kinds = `appointment approval approvalChase approvalLink asset bookingService bookingWaitlist calendarAbsence calendarResource calendarSeries calendarTechnician chaseOptOut chasePolicy chaseTask contact counterIntake creditNote customerAccount customerBilling customerMerge declinedWork diagnosis diagnosticResult diagnosisLink diagnosisLinkView estimate event export flow handoff handover inspection inspectionJob inspectionReport inspectionReportDelivery inspectionTemplate intake intakeComparison intakeForm intakeSecretAudit intakeTemplate invoice invoiceDocument invoiceDelivery job jobNote payRate payment pricingMatrix promise promiseNotice promisePlan promiseRevision promiseSettings proposal purchaseComparison purchaseSubmission purchaseBill purchaseOrder purchaseReceipt quality rateProfile reading refund retentionHold retentionPolicy retentionReceipt returnDelegate returnOverride routingBlocker routingCase routingPolicy serviceInterval specialPart specialPartNotice stageEvent stockTransfer stockTransferException stockRma stockCore stockSupplierCredit stockReplenishment stockBin stockCount stockItem stockLot stockLotAdjustment stockMovement stockReceipt stockReservation stockUse sublet subtask taxCertificate taxDiscountRule taxFeeRule taxJurisdiction taxSettings timeCorrection timeEntry waitlistOffer warranty warrantyTerms`.split(' ')
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
 const jobKinds = 'approvalChase approvalLink chaseTask customerBilling declinedWork diagnosis diagnosticResult diagnosisLink estimate flow handoff handover inspection inspectionReport inspectionReportDelivery intake intakeComparison intakeForm invoice jobNote payment promise promiseNotice promisePlan promiseRevision proposal quality reading returnDelegate returnOverride routingBlocker routingCase serviceInterval specialPart specialPartNotice stageEvent stockReservation stockUse sublet subtask warranty warrantyTerms'
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
