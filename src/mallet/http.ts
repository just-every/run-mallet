import {assistantsPage} from './ui/assistants'
import {assistantCommand,scopedAssistantView} from './assistant-door'
import {statusNoticeCommand,statusNoticeState} from './status-notice-door'
import {internalStatusCommands} from './status-notices'
import {statusNoticePage} from './ui/status-notices'
import {profitabilityReport} from './reports/profitability'
import {profitabilityPage,profitabilitySettings} from './ui/profitability'
import {reviewCommand,reviewState} from './review-door'
import {reviewResponse} from './review-customer-door'
import {internalReviewCommands} from './reviews'
import {reviewPanel} from './ui/reviews'
import {internalOutreachCommands} from './outreach'
import {outreachCommand} from './outreach-door'
import {stripeResponse} from './stripe/door'
import {staffCommand,grantStaff,staffSettings,staffState,staffPage} from './staff'
import {auditReport,auditPage,auditCsv} from './audit'
import {receivablesPage,receivablesInput,filingPage} from './ui/receivables'
import {filingTax} from './filing-tax'
import {accountStatement,utcDate} from './receivables'
import {depositsPage,depositFormInput} from './ui/deposits'
import {depositBalance} from './deposits'
import {supplierOrdersPage,supplierOrdersFormInput} from './ui/supplier-orders'
import {supplierOrderReport} from './supplier-orders'
import {supplierDoor} from './supplier-door'
import {internalSupplierCommands} from './supplier-orders'
import {transfersPage,transferFormInput} from './ui/stock-transfers'
import {transferReport} from './stock-transfers'
import {rmasPage,rmaFormInput} from './ui/supplier-returns'
import {rmaReport} from './supplier-returns'
import {coresPage,coresFormInput} from './ui/cores'
import {coreReport} from './cores'
import {replenishmentPage,replenishmentFormInput} from './ui/replenishment'
import {replenishmentReport} from './stock-replenishment'
import {taxCustodyPage} from './ui/tax-custody'
import {jurisdictionReport} from './tax'
import {invoiceDocumentsPage} from './ui/invoice-documents'
import {documentHtml,internalDocumentCommands} from './invoice-documents'
import {sendInvoice} from './invoice-document-door'
import {assetNativeInput} from './ui/asset-types'
import {workshopPortabilityResponse} from './portability-door'
import {timedMalletResponse} from './request-timing'
import {loadRepairState} from './read-model/repair'
import {searchAccounts} from './read-model/search'
import {jobsResponse} from './jobs/door'
import {retentionCommand,retentionCommands} from './retention'
import {retentionPage} from './ui/retention'
import {calendarAuthority} from './calendar-door'
import {calendarPage} from './ui/calendar'
import {calendarFormInput} from './ui/calendar-forms'
import {waitlistCommand} from './waitlist-door'
import {internalWaitlistCommands} from './booking-waitlist'
import {waitlistFormInput} from './ui/waitlist'
import {enterpriseResponse} from './enterprise/door'
import {securityResponse} from './strong-auth/door'
import {connectorsResponse} from './connectors/door'
import {saveSecret,revokeSecret} from './connectors/secrets'
import {connectorSecret} from './connectors/secrets'
import {requireStepUp,needsStepUp} from './strong-auth/gate'
import {guardLinks} from './strong-auth/link-guard'
import {inspectionReportEventResponse} from './inspection-report-events'
import {inspectionReportInput,sendInspectionReport} from './inspection-report-door'
import {internalReportCommands} from './inspection-reports'
import {reportFormInput} from './ui/inspection-reports'
import {bookingResponse,revokeBookingLink} from './booking-door'
import {internalBookingCommands} from './bookings'
import {bookingStaff,bookingFormInput} from './ui/bookings'
import {checkInResponse,createCheckInLink} from './check-in-door'
import {internalCheckInCommands} from './check-in'
import {checkInQueuePage,checkInFormInput} from './ui/check-in'
import {internalRefundCommands} from './credits'
import {refundDoor} from './refund-door'
import {intakeFormResponse,createIntakeFormLink} from './intake-form-door'
import {internalIntakeFormCommands} from './intake-forms'
import {intakeTemplatesPage,intakeTemplateInput,signedIntakeReceipt} from './ui/intake-forms'
import {sendBalanceReminder} from './receivables-mail'
import {returnPage,returnFormInput,handoverReceipt} from './ui/returns'
import {collectionInput,verifyStripePayment} from './payment-door'
import {warrantyPage,warrantyFormInput} from './ui/warranty'
import {intakePage,intakeFormInput} from './ui/intake'
import {intakeSecret,expireIntakeSecrets,purgeIntakeSecrets} from './intake-secrets'
import {tracePage,traceFormInput} from './ui/stock-trace'
import {traceReport} from './stock-trace'
import {accountsPage,customerFormInput} from './ui/customers'
import {accountResultsPage} from './ui/account-results'
import {customerSearch} from './customers'
import {mergePreviewPage} from './ui/customers'
import {portalResponse} from './portal-door'
import {purchasingPage,purchasingFormInput} from './ui/purchasing'
import {purchaseStatus} from './purchasing'
import {inventoryPage,countPage,inventoryFormInput} from './ui/inventory'
import {stockReport} from './inventory'
import {subletFormInput} from './ui/sublet'
import {configureReportSchedule,reportFilterView} from './reports/schedules'
import {reportXlsx} from './reports/xlsx'
import {reportFormat,technicianCsv,turnaroundCsv} from './reports/csv'
import {turnaroundPage} from './ui/turnaround'
import {turnaroundReport} from './reports/turnaround'
import {rateProfilePanel} from './ui/rate-profiles'
import {routingCommand} from './routing-door'
import {specialPartNotices} from './ui/special-parts'
import {scopedPromises,internalPromiseCommands} from './promises'
import {boardFilter,repairBoard,scopedFlow} from './flow'
import {sendPromiseNotice} from './promise-door'
import {promiseFormInput,promisePlan} from './ui/promises'
import {timePanel,timeFormInput} from './ui/time'
import {scopedTime} from './time'
import {period,technicianReport} from './reports/technicians'
import {technicianReportPage} from './ui/reports'
import {createLink,customerLinkResponse,diagnosisInput,diagnosisMedia} from './diagnosis-links'
import {diagnosisFormInput} from './ui/diagnostics'
import {approvalReceipt,approvalResponse,sendApprovalLink} from './approval-door'
import {internalApprovalCommands} from './approval-links'
import {internalChaseCommands} from './approval-chasing'
import {onCrew,scopedCollaboration} from './collaboration'
import {waitingForMe} from './ui/collaboration'
import {chasePage} from './ui/chasing'
import {pricingFormInput,pricingOverrideInput} from './ui/pricing'
import {inspectionFormInput} from './ui/inspections'
import {inspectionRecordInput,inspectionPhotos} from './inspection-photo'
import {withoutInspectionSource,withoutInspections} from './inspection-visibility'
import type { Bindings } from '../auth.server'
import { runtimeBindings } from '../auth.server'
import {boundedJson} from '@runeditrun/rer/modules/portability/http'
import {MAX_LINE_BYTES} from '@runeditrun/rer/modules/portability/format'
import { createPortability } from '@runeditrun/rer/modules/portability'
import policy from './archive-policy.mjs'
import {identity,originGuard,human,agentKey,HttpError,type Actor} from './auth'
import {execute,load,MalletError,type State} from './model'
import {assetHistoryCsv} from './workshop'
import {catalogue} from './pier'
import {mediaResponse} from './media/http'
import {uploadScope} from './media/service'
import {uploadView} from './media/types'
import {mediaPage,mediaPreview} from './ui/media'
import {restorePage} from './ui/restore'
import {UNVERIFIED_ERASURE_HISTORY} from './restore/notice.mjs'
import {e,rows,money,when,status,type Names} from './ui/common'
import {page,type Section,type Counts} from './ui/shell'
import {conflictPage} from './ui/conflict'
import {errorMessage,notFound,refused} from './ui/errors'
import {repairOrders,customers,approvals,assetPage} from './ui/workshop'
import {shopBoard} from './ui/board'
import {repair,waiting} from './ui/repair'
import {qualityFormInput} from './ui/quality'
import {jobPage} from './ui/job'
import {taxPage,taxNotice,invoiceTotals,lineTax} from './ui/tax'
import {moveIn,importPreview,importJournal,dataPage} from './ui/data'
import * as imports from './imports/index'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers})
const redirect=(path:string)=>new Response(null,{status:303,headers:{...headers,location:path}})
const csv=(value:string,name:string)=>new Response(value,{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${name}.csv"`}})
const xlsx=(value:string,name:string)=>new Response(reportXlsx(value),{headers:{...headers,'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="${name}.xlsx"`}})
async function textBody(request:Request) {
 const reader=request.body?.getReader();if(!reader)return ''
 const chunks:Uint8Array[]=[];let length=0
 try {for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>1024*1024)throw new HttpError(413,'body_too_large');chunks.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes)
}
async function body(request:Request) {
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'json_required')
 try { const input=JSON.parse(await textBody(request));if(!input||typeof input!=='object'||Array.isArray(input))throw Error();return input } catch(error) {if(error instanceof HttpError)throw error;throw new HttpError(400,'invalid_json')}
}
async function nativeForm(request:Request) {
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new HttpError(415,'form_required')
 const data=new FormData();for(const [key,value] of new URLSearchParams(await textBody(request)))data.append(key,value)
 return data
}
const withoutSubletCosts=(value:any)=>{if(!value||!('sublets' in value))return value;const {sublets,...rest}=value;return rest}
function withoutFleetApproval(value:any):any {
 if(Array.isArray(value))return value.map(withoutFleetApproval)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='fleet').map(([key,v])=>[key,withoutFleetApproval(v)]))
 return value
}
function visible(s:State,actor:Actor):State {
 if(actor.role!=='owner')s={...s,records:Object.fromEntries(Object.entries(s.records).filter(([kind])=>!kind.startsWith('assistant')).map(([kind,values])=>[kind,kind==='event'?values.filter(x=>!x.kind.startsWith('assistant.')):values]))}

 s={...s,records:{...s.records,reportDelivery:rows(s,'reportDelivery').filter(r=>r.ownerId===actor.id),reportFilter:rows(s,'reportFilter').filter(r=>r.ownerId===actor.id)}}
 if(actor.role!=='owner'){s={...s,records:{...Object.fromEntries(Object.entries(s.records).filter(([kind])=>!kind.startsWith('stripe'))),event:rows(s,'event').filter(r=>!r.kind.startsWith('stripe.'))}};s=withoutFleetApproval(s)}
 if(actor.role==='owner')s={...s,records:{...s.records,deposit:rows(s,'deposit').map(d=>({...d,balance:depositBalance(s,d)}))}}
 if(actor.role!=='owner')s={...s,records:{...s.records,handover:rows(s,'handover').map(r=>{const {accountTerms,...settlement}=r.settlement;return {...r,settlement}})}}
 if(actor.role!=='owner'){const {audit:_audit,...records}=s.records;s={...s,records}}
 if(actor.role!=='owner')s={...s,records:Object.fromEntries(Object.entries(s.records).filter(([kind])=>!['taxCreditBasis','tenderClearance','arTerms','arInvoice','arDispute','arPromise','arReminder','deposit','retentionPolicy','retentionHold','retentionReceipt','diagnosticResult'].includes(kind)))}
 if(actor.role!=='owner')s={...s,records:{...s.records,event:rows(s,'event').filter(row=>!row.kind.startsWith('tax.creditBasis')&&!row.kind.startsWith('tender.')&&!row.kind.startsWith('ar.')&&!row.kind.startsWith('deposit.')&&!row.kind.startsWith('diagnosticResult.'))}}
 if(!human(actor))s={...s,records:Object.fromEntries(Object.entries(s.records).map(([k,v])=>[k,(k.startsWith('calendar')||k==='bookingWaitlist'||k==='waitlistOffer'||k==='appointment'||k==='bookingService'||k==='counterIntake'||k.startsWith('intake')||['warranty','warrantyTerms','payment','handover','returnDelegate','returnOverride'].includes(k))?[]:k==='event'?v.filter(x=>!x.kind.startsWith('calendar.')&&!x.kind.startsWith('waitlist.')&&!x.kind.startsWith('booking.')&&!x.kind.startsWith('checkin.')&&!x.kind.startsWith('intake.')&&!x.kind.startsWith('warranty.')&&!x.kind.startsWith('payment.')&&!x.kind.startsWith('return.')):v]))}
 s=scopedCollaboration(scopedPromises(s,actor),actor)
 s=scopedTime(s,actor)
 if(actor.role!=='owner'){const {reviewConsent:_reviewConsent,reviewRequest:_reviewRequest,...privateReviewRecords}=s.records;s={...s,records:{...privateReviewRecords,...(s.records.subtask?{subtask:s.records.subtask.filter(t=>t.kind!=='review-feedback')}:{}),event:rows(s,'event').filter(x=>!x.kind.startsWith('review.'))}}}
 if(actor.role!=='owner'){const {statusConsent:_statusConsent,statusNotice:_statusNotice,...statusRecords}=s.records;s={...s,records:{...statusRecords,...(s.records.subtask?{subtask:s.records.subtask.filter(t=>t.kind!=='pickup-followup')}:{}),event:rows(s,'event').filter(x=>!x.kind.startsWith('statusNotice.'))}}}
 if(actor.role!=='owner'){const {outreach:_outreach,...privateRecords}=s.records;s={...s,records:{...privateRecords,event:rows(s,'event').filter(x=>!x.kind.startsWith('outreach.'))}}}
 if(actor.role!=='owner'){const {taxCertificate:_certificates,taxFeeRule:_feeRules,taxDiscountRule:_discountRules,taxJurisdiction:_jurisdiction,invoiceDocument:_docs,invoiceDelivery:_delivery,...records}=s.records;s={...s,records:{...records,event:rows(s,'event').filter(x=>!x.kind.startsWith('invoice.delivery')&&x.kind!=='invoice.issue'&&!x.kind.startsWith('tax.certificate')&&!x.kind.startsWith('tax.assignJurisdiction'))}}}
 if(!human(actor)){s={...s,records:Object.fromEntries(Object.entries(s.records).filter(([k])=>!['contact','customerAccount','customerMerge','customerBilling'].includes(k)))};s={...s,records:{...s.records,event:rows(s,'event').filter(x=>!x.kind.startsWith('contact.')&&!x.kind.startsWith('customer.')),invoice:rows(s,'invoice').map(i=>{const {billing,...rest}=i;return rest})}}}
 if(!human(actor)){const records=Object.fromEntries(Object.entries(s.records).filter(([k])=>!k.startsWith('stock')&&!k.startsWith('purchase')));s={...s,records:{...records,event:(records.event??[]).filter(x=>!x.kind.startsWith('stock.')&&!x.kind.startsWith('purchase.'))}}}
 if(!human(actor))s={...s,records:{...s.records,event:rows(s,'event').filter(e=>!e.kind.startsWith('routing.'))}}
 if(actor.role!=='owner')s={...s,records:{...s.records,payment:rows(s,'payment').map(p=>{if(!p.depositId)return p;const {depositId,evidence,...allocation}=p;return allocation})}}
 if(actor.role!=='owner'){const {costRate:_costRates,payRate:_rates,creditNote:_credits,refund:_refunds,...records}=s.records;s={...s,records:{...records,event:rows(s,'event').filter(x=>!x.kind.startsWith('credit.')&&!x.kind.startsWith('refund.'))}}}
 // Diagnostic notes and customer links are native staff evidence; agents never receive them.
 if(actor.role==='agent'){const {diagnosis:_d,diagnosisLink:_l,diagnosisLinkView:_v,approvalLink:_a,approvalChase:_c,chaseOptOut:_o,chaseTask:_t,...records}=s.records;s={...s,records:{...records,event:rows(s,'event').filter(x=>!x.kind.startsWith('diagnosis'))}}}
 if(actor.role==='agent'){const {routingPolicy:_routingPolicy,routingCase:_routingCase,routingBlocker:_routingBlocker,specialPart:_parts,specialPartNotice:_notices,sublet:_sublets,...records}=s.records;return withoutInspections({...s,records:{...records,event:(records.event??[]).filter(x=>!x.kind.startsWith('sublet.')),invoice:(records.invoice??[]).map(withoutSubletCosts)}})}
 if(actor.role!=='member')return s
 const jobs=rows(s,'job').filter(j=>onCrew(j,actor.id)),ids=new Set(jobs.map(j=>j.id)),assets=new Set(jobs.map(j=>j.assetId))
 return {version:s.version,records:{reportDelivery:rows(s,'reportDelivery'),reportFilter:rows(s,'reportFilter'),jobNote:rows(s,'jobNote'),subtask:rows(s,'subtask'),handoff:rows(s,'handoff'),promiseSettings:rows(s,'promiseSettings'),promise:rows(s,'promise'),promisePlan:rows(s,'promisePlan'),timeEntry:rows(s,'timeEntry'),timeCorrection:rows(s,'timeCorrection'),job:jobs,asset:rows(s,'asset').filter(a=>assets.has(a.id)).map(a=>({...a,visits:a.visits.filter((id:string)=>ids.has(id))})),estimate:rows(s,'estimate').filter(x=>ids.has(x.jobId)),declinedWork:rows(s,'declinedWork').filter(x=>ids.has(x.jobId)),reading:rows(s,'reading').filter(x=>ids.has(x.jobId)),serviceInterval:rows(s,'serviceInterval').filter(x=>ids.has(x.jobId)),quality:rows(s,'quality').filter(x=>ids.has(x.jobId)),diagnosis:rows(s,'diagnosis').filter(x=>ids.has(x.jobId)),flow:scopedFlow(s,ids),inspection:rows(s,'inspection').filter(x=>ids.has(x.jobId)),stageEvent:rows(s,'stageEvent').filter(x=>ids.has(x.jobId)),event:rows(s,'event').filter(x=>!x.kind.startsWith('sublet.')&&(ids.has(x.jobId)||x.kind.startsWith('time.')&&x.data.ownerId===actor.id))}}
}
async function operators(db:D1Database) {
 const people=(await db.prepare("SELECT id,display_name AS name,role,status FROM oa_operators WHERE status IN ('active','invited') ORDER BY created_at,id").all<{id:string,name:string,role:string,status:string}>()).results
 return {list:people,names:Object.fromEntries(people.map(o=>[o.id,o.name])) as Names}
}
const bookingFields=['title','bayId','technicianId','startAt','endAt']
function formInput(data:FormData) {
 const input:any=Object.fromEntries(data)
 if(input.command?.startsWith('assistant.')){input.confirm=data.has('confirm');if(input.version!==undefined)input.version=Number(input.version);if(input.assistantSubject){const subject=JSON.parse(input.assistantSubject);input.kind=subject.kind;input.subjectId=subject.subjectId;input.channel=subject.kind==='send'?'email':'none';input.spendCents=0}}

 if(input.command==='statusNotice.consent')input.consent=data.has('consent')
 if(input.command==='statusNotice.approve'){input.confirm=data.has('confirm');for(const key of ['allowedStart','allowedEnd','jobVersion'])input[key]=Number(input[key])}
 if(input.command==='review.consent')input.consent=data.has('consent')
 if(input.command==='review.send')input.confirm=data.has('confirm')
 if(input.command==='outreach.schedule'){input.consent=data.has('consent');input.availabilityConfirmed=data.has('availabilityConfirmed');for(const key of ['allowedStart','allowedEnd','quoteVersion','outstandingCents'])if(input[key]!==undefined)input[key]=Number(input[key])}
 if(input.command==='reportFilter.schedule'){input.active=data.has('active');input.consent=data.has('consent');input.everyDays=Number(input.everyDays);input.nextAt=String(input.nextAt).endsWith('Z')?input.nextAt:String(input.nextAt)+':00Z'}
 if(input.staffJob!==undefined&&input.command==='estimate.prepare'||input.staffInvoice!==undefined&&input.command==='payment.record'){let source:any;try{source=JSON.parse(input.staffJob??input.staffInvoice)}catch{throw new HttpError(400,'invalid_staff_source')};if(input.command==='estimate.prepare')input.jobId=source.jobId;else input.invoiceId=source.invoiceId;input.version=source.version}
 assetNativeInput(input)
 if(['staff.grant','staff.revoke'].includes(input.command)){for(const key of ['discountBps','spendCents','refundCents','version'])input[key]=Number(input[key]??0);if(input.discountPercent!==undefined)input.discountBps=Math.round(Number(input.discountPercent)*100);if(input.spendUsd!==undefined)input.spendCents=Math.round(Number(input.spendUsd)*100);if(input.refundUsd!==undefined)input.refundCents=Math.round(Number(input.refundUsd)*100)}
 if(retentionCommands.includes(input.command)){input.consent=input.consent==='yes';if(['retention.preview','customer.erase','retention.run'].includes(input.command))input.categories=data.getAll('categories');for(const key of ['mediaDays','personalDays','auditMinimumDays'])if(key in input)input[key]=input[key]===''?null:Number(input[key])}
 for(const name of ['accountVersion','flowVersion','version','itemVersion','revision','quantity','value','dueValue'])if(input[name]!==undefined&&input[name]!=='')input[name]=Number(input[name])
 if(data.has('lineIds') || input.command==='estimate.authorise')input.lineIds=data.getAll('lineIds')
 if(['estimate.prepare','estimate.revise'].includes(input.command)) {
  input.lines=['part','labor'].map(kind=>({kind,description:input[`${kind}Description`],quantity:Number(input[`${kind}Quantity`]),unitCents:Math.round(Number(input[`${kind}Price`])*100),...(input[`${kind}Discount`]?{unitDiscountCents:Math.round(Number(input[`${kind}Discount`])*100)}:{}),...(kind==='part'&&input.partCost?{costCents:Math.round(Number(input.partCost)*100)}:{})}))
  if(input.feeDescription)input.lines.push({kind:'fee',description:input.feeDescription,quantity:1,unitCents:Math.round(Number(input.feePrice)*100),feeTaxable:input.feeTaxable==='yes'})
  if(input.rateProfileSource){let source:any;try{source=JSON.parse(input.rateProfileSource)}catch{throw new HttpError(400,'invalid_rate_profile')};input.rateProfileId=source.id;input.rateProfileVersion=source.version}
 }
 if(input.command==='rateProfile.save'){input.laborRateCents=Math.round(Number(input.laborRateUsd)*100);if(!input.id)delete input.id}
 if(input.command==='estimate.prepare'&&input.supplement==='yes')input.supplement=true
 if(input.command==='estimate.prepare'&&input.replacementSource) {
  let source:any;try{source=JSON.parse(input.replacementSource)}catch{throw new HttpError(400,'invalid_replacement')}
  input.lines=[{kind:source.kind,description:source.description,quantity:Number(input.replacementQuantity),unitCents:Math.round(Number(input.replacementPrice)*100),...(source.kind==='fee'?{feeTaxable:source.feeTaxable}:{}),replaces:{estimateId:source.estimateId,revision:source.revision,lineId:source.lineId}}]
 }
 if(input.command==='tax.discountRule')input.rateBps=Number(input.rateBps)
 if(input.command==='tax.suppliesRule'){input.fixedCents=Math.round(Number(input.fixedUsd)*100);input.rateBps=Number(input.rateBps);input.capCents=Math.round(Number(input.capUsd)*100);input.taxable=data.has('taxable')}
 if(input.command==='tax.adjustEstimate'){input.consent=data.has('consent');if(input.feeSource){const source=JSON.parse(input.feeSource);input.feeRuleId=source.id;input.feeVersion=source.version}if(input.discountSource){const source=JSON.parse(input.discountSource);input.discountRuleId=source.id;input.discountVersion=source.version}}
 if(input.command==='invoice.send')input.consent=data.has('consent')
 if(input.command==='tax.configure'){input.ratePercent=input.ratePercent===''?null:Number(input.ratePercent);input.partsTaxable=data.has('partsTaxable');input.laborTaxable=data.has('laborTaxable')}
 if(input.command==='decline.reprice')input.unitCents=Math.round(Number(input.unitCents)*100)
 if(input.channel)input.method=input.channel
 if(input.command==='approvalLink.create')input.days=Number(input.days)
 if(input.command==='subtask.create')input.dependsOn=data.getAll('dependsOn')
 if(input.command==='note.add'){input.mentionIds=data.getAll('mentionIds');input.attachmentIds=data.getAll('attachmentIds')}
 if(input.command==='handoff.propose')input.keepHelper=data.get('keepHelper')==='yes'
 if(input.command==='chasePolicy.save'){input.linkDays=Number(input.linkDays);input.reminderDays=String(input.reminderDays??'').split(',').map(d=>d.trim()).filter(Boolean).map(Number)}
 if(input.command.startsWith('specialPart.')){if(input.partVersion!==undefined)input.partVersion=Number(input.partVersion);if(input.source){let source:any;try{source=JSON.parse(input.source)}catch{throw new HttpError(400,'invalid_source')};input.estimateId=source.estimateId;input.revision=source.revision;input.lineId=source.lineId}}
 if(['payRate.set','costRate.set'].includes(input.command)){input.centsPerHour=Math.round(Number(input.rate)*100);delete input.rate}
 reportFormInput(data,input)
 calendarFormInput(data,input);waitlistFormInput(data,input)
 bookingFormInput(data,input)
 checkInFormInput(data,input)
 intakeTemplateInput(data,input)
 if(input.command==='intakeForm.create'&&input.templateSource){let t:any;try{t=JSON.parse(input.templateSource)}catch{throw new HttpError(400,'invalid_template')};input.templateId=t.id;input.templateVersion=t.version}
 returnFormInput(data,input)
 warrantyFormInput(input)
 receivablesInput(input)
 depositFormInput(input)
 intakeFormInput(data,input)
 customerFormInput(data,input)
 supplierOrdersFormInput(input)
 purchasingFormInput(input)
 traceFormInput(input)
 transferFormInput(input)
 rmaFormInput(input)
 coresFormInput(input)
 replenishmentFormInput(input)
 inventoryFormInput(input)
 subletFormInput(data,input)
 return promiseFormInput(data,diagnosisFormInput(data,timeFormInput(data,pricingOverrideInput(data,pricingFormInput(data,inspectionFormInput(data,qualityFormInput(data,input)))))))
}
export async function malletResponse(request:Request,original:Bindings,execution:Pick<ExecutionContext,'waitUntil'>):Promise<Response|null> {
 return timedMalletResponse(request,()=>workshopResponse(request,original,execution))
}
async function workshopResponse(request:Request,original:Bindings,execution:Pick<ExecutionContext,'waitUntil'>):Promise<Response|null> {
 const url=new URL(request.url),path=url.pathname
 const enterprise=await enterpriseResponse(request,original);if(enterprise)return enterprise
 const stripe=await stripeResponse(request,original);if(stripe)return stripe
 const deliveryEvent=await inspectionReportEventResponse(request,original);if(deliveryEvent)return deliveryEvent
 const customerDoor=await guardLinks(request,original,async()=>{
  const review=await reviewResponse(request,original);if(review)return review
  const booking=await bookingResponse(request,original);if(booking)return booking
  const checkIn=await checkInResponse(request,original);if(checkIn)return checkIn
  const portal=await portalResponse(request,original,execution);if(portal)return portal
  const intakeForm=await intakeFormResponse(request,original);if(intakeForm)return intakeForm
  const customer=await customerLinkResponse(request,original);if(customer)return customer
  return approvalResponse(request,original)
 });if(customerDoor)return customerDoor
 const jobs=await jobsResponse(request,original);if(jobs)return jobs
 const security=await securityResponse(request,original);if(security)return security
 const connectors=await connectorsResponse(request,original);if(connectors)return connectors
 if(path!=='/restore' && path!=='/app' && !path.startsWith('/app/') && !path.startsWith('/api/mallet/') && !path.startsWith('/api/portability/'))return null
 const env=runtimeBindings(original),isApi=path.startsWith('/api/')
 let actor:Actor|undefined,submitted:any
 try {
  const auth=await identity(request,env);actor=auth.actor;originGuard(request,env,auth.bearer)
  if(actor.assistantGrantId){
   if(path==='/api/mallet/assistant'&&['GET','HEAD'].includes(request.method))return json(await scopedAssistantView(env,auth))
   if(path!=='/api/mallet/commands'||request.method!=='POST')throw new HttpError(403,'assistant_scope_required')
  }
  if(path==='/app'&&actor.staff)return redirect('/app/staff')
  if(['/app/staff','/api/mallet/staff/state'].includes(path)){if(!actor.staff)throw new HttpError(403,'staff_grant_required');const view=staffState(await load(env.DB),actor);if(!await env.DB.prepare(`SELECT 1 AS ok WHERE (${auth.authority.sql})`).bind(...auth.authority.params).first())throw new HttpError(403,'staff_grant_required');return path==='/app/staff'?page('Staff workspace',staffPage(view),actor,200,{section:'data'}):url.searchParams.has('download')?new Response(JSON.stringify(view,null,2),{headers:{...headers,'content-type':'application/json','content-disposition':'attachment; filename="mallet-staff.json"'}}):json(view)}
  if(path==='/app/settings/assistants'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');return page('Assistant settings',assistantsPage(await load(env.DB),new Set((await env.DB.prepare('SELECT grant_id FROM mallet_assistant_keys').all<{grant_id:string}>()).results.map(k=>k.grant_id))),actor,200,{section:'data'})}
  if(path==='/app/staff-access'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');return page('Staff roles & limits',await staffSettings(env.DB),actor,200,{section:'data'})}
  if(['/app/audit','/api/mallet/audit'].includes(path)){
   if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'method_not_allowed')
   const report=await auditReport(env.DB,actor,auth.authority,url.searchParams),format=url.searchParams.get('format')
   if(format&&!['json','csv'].includes(format))throw new HttpError(400,'invalid_audit_format')
   if(path==='/app/audit')return page('Accountable changes',auditPage(report,url.searchParams),actor,200,{section:'data'})
   if(format==='csv')return csv(auditCsv(report.entries),'mallet-audit')
   if(format==='json')return new Response(JSON.stringify(report,null,2),{headers:{...headers,'content-type':'application/json','content-disposition':'attachment; filename="mallet-audit.json"'}})
   return json(report)
  }
  if(path==='/api/mallet/board-revision'&&request.method==='GET'){if(actor.role==='agent')throw new HttpError(403,'staff_required');const row=await env.DB.prepare(`SELECT version FROM mallet_meta WHERE id=1 AND (${auth.authority.sql})`).bind(...auth.authority.params).first();if(!row)throw new HttpError(403,'staff_required');return json(row)}
  const coreRepair=path.match(/^\/api\/mallet\/repairs\/([^/]+)$/)
  if(coreRepair&&['GET','HEAD'].includes(request.method))return json({actor,...visible(await loadRepairState(env.DB,actor,auth.authority,coreRepair[1]),actor)})
  if(path==='/api/mallet/accounts'&&['GET','HEAD'].includes(request.method))return json(await searchAccounts(env.DB,actor,auth.authority,url.searchParams.get('q')??'',url.searchParams.get('cursor')??undefined))
  if(path==='/app/accounts'&&['GET','HEAD'].includes(request.method)&&!url.searchParams.has('manage')){const q=url.searchParams.get('q')??'';return page('Customer accounts',accountResultsPage(q,await searchAccounts(env.DB,actor,auth.authority,q,url.searchParams.get('cursor')??undefined)),actor,200,{section:'customers'})}
  if(path.startsWith('/api/mallet/media/'))return await mediaResponse(request,env,actor,auth.authority)
  if(!['GET','POST','PUT','HEAD'].includes(request.method))throw new HttpError(405,'method_not_allowed')
  if(path.startsWith('/api/portability/')) {
   if(actor.role!=='owner')throw new HttpError(403,'owner_required')
   const finalizing=request.method==='POST'&&/^\/api\/portability\/imports\/[^/]+\/finalize$/.test(path),input:any=finalizing?await boundedJson(request.clone(),MAX_LINE_BYTES):null
   const response=await workshopPortabilityResponse(request,env)
   if(finalizing&&response?.ok){const result=await response.json() as Record<string,unknown>;return json({...result,erasureHistory:input?.laterJournal?'journal-supplied':'unverified',erasureNotice:input?.laterJournal?'Erasure journal supplied; freshness depends on this being the latest trusted source archive.':UNVERIFIED_ERASURE_HISTORY})}
   return response
  }
  if(path==='/restore'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'method_not_allowed');return page('Restore workshop',restorePage(),actor,200,{section:'data',restore:true})}
  if(path.startsWith('/api/mallet/imports/') || path.startsWith('/app/move-in/')) {
   if(!human(actor))throw new HttpError(403,'manager_required')
   const api=path.startsWith('/api/'),action=path.split('/').at(-1)
   if(action==='journal' && request.method==='GET') {
    const result=await imports.journal(env.DB,actor,url.searchParams.get('id')??'',auth.authority)
    return api?json(result):page('Import journal',importJournal(result),actor,200,{section:'move-in'})
   }
   if(request.method!=='POST')throw new HttpError(405,'post_required')
   const data=api?await body(request):Object.fromEntries(await nativeForm(request))
   if(action==='resume'){const result=await imports.resume(env.DB,actor,String(data.id),auth.authority);return api?json(result):redirect(`/app/move-in/journal?id=${encodeURIComponent(result.id)}`)}
   if(action==='undo') {const result=await imports.undo(env.DB,actor,String(data.id),auth.authority);return api?json(result):redirect(`/app/move-in/journal?id=${encodeURIComponent(result.id)}`)}
   const input=api?data:{customers:JSON.parse(String(data.customers)),assets:JSON.parse(String(data.assets)),fingerprint:data.fingerprint}
   if(action==='preview'){const result=await imports.preview(env.DB,actor,input,auth.authority);return api?json(result):page('Review move-in',importPreview(input,result),actor,200,{section:'move-in'})}
   if(action==='apply') {if(!api && data.confirm!=='yes')throw new HttpError(400,'confirmation_required');const result=await imports.apply(env.DB,actor,input,auth.authority);return api?json(result):redirect(`/app/move-in/journal?id=${encodeURIComponent(result.id)}`)}
   throw new HttpError(404,'not_found')
  }
  if((path==='/api/mallet/commands'||path==='/app/actions') && request.method==='POST') {
   const data=path==='/app/actions'?formInput(await nativeForm(request)):await body(request),command=String(data.command),input=data.input??data
   submitted={command,input}
   if(actor.assistantGrantId&&!command.startsWith('assistant.'))throw new HttpError(403,'assistant_scope_required')
   let result:any
   if(['connector.save','connector.revoke'].includes(command)&&actor.role==='owner'&&!auth.gate?.enrolled)throw new HttpError(403,'step_up_required','Enrol your own second factor before opening the credential door.')
   if(needsStepUp(command,actor.role))auth.authority=requireStepUp(auth,command.startsWith('deposit.'))
   if(internalStatusCommands.includes(command))throw new HttpError(404,'unknown_command')
   if(internalReviewCommands.includes(command))throw new HttpError(404,'unknown_command')
   if(internalOutreachCommands.includes(command))throw new HttpError(404,'unknown_command')
   if(command.startsWith('stripe.'))throw new HttpError(404,'unknown_command')
   if(command.startsWith('reportDelivery.'))throw new HttpError(404,'unknown_command')
   if(['ar.reminderClaim','ar.reminderOutcome'].includes(command)||internalSupplierCommands.includes(command)||internalDocumentCommands.includes(command)||internalWaitlistCommands.includes(command)||internalReportCommands.includes(command)||internalBookingCommands.includes(command)||internalCheckInCommands.includes(command)||internalRefundCommands.includes(command)||internalIntakeFormCommands.includes(command)||command==='payment.verified'||command==='routing.sweep'||internalPromiseCommands.includes(command)||internalApprovalCommands.includes(command)||internalChaseCommands.includes(command))throw new HttpError(404,'unknown_command')
   if(command.startsWith('assistant.')){if(['assistant.grant','assistant.revoke','assistant.review'].includes(command)&&actor.role==='owner')auth.authority=requireStepUp(auth);result=await assistantCommand(env,auth,command,input)}
   else if(actor.staff){if(command==='job.book')auth.authority=await calendarAuthority(env,command,input,auth.authority);if(['payment.record','credit.issue','refund.record'].includes(command))auth.authority=requireStepUp(auth);result=await staffCommand(env.DB,actor,auth.authority,command,input)}
   else if(['staff.grant','staff.revoke'].includes(command)){auth.authority=requireStepUp(auth);result=await grantStaff(env.DB,actor,auth.authority,command,input)}
   else if(command==='reportFilter.schedule')result=await configureReportSchedule(env,actor,auth.authority,input)
   else if(command==='ar.remind')result=await sendBalanceReminder(env,actor,auth.authority,input)
   else if(command==='invoice.send')result=await sendInvoice(env,actor,auth.authority,input)
   else if(retentionCommands.includes(command))result=await retentionCommand(env,actor,auth.authority,command,input)
   else if(command.startsWith('waitlist.'))result=await waitlistCommand(env,request,actor,auth.authority,command,input)
   else if(command.startsWith('calendar.')||['job.book','dispatch.approve'].includes(command))result=await execute(env.DB,actor as any,command,input,await calendarAuthority(env,command,input,auth.authority))
   else if(command==='inspectionReport.review'){const checked=await inspectionReportInput(env.DB,actor,auth.authority,input);result=await execute(env.DB,actor as any,command,checked.input,checked.authority)}
   else if(command==='inspectionReport.send')result=await sendInspectionReport(env,actor,auth.authority,input)
   else if(command==='booking.publish'){if(!human(actor))throw new HttpError(403,'manager_required');const active=(await operators(env.DB)).list.filter(x=>x.status==='active');if(!Array.isArray(input.windows)||input.windows.some((w:any)=>!active.some(x=>x.id===w.technicianId)))throw new HttpError(400,'active_staff_required');const technicians=[...new Set(input.windows.map((w:any)=>String(w.technicianId)))];const guard={sql:'('+auth.authority.sql+') AND '+technicians.map(()=>"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')").join(' AND '),params:[...auth.authority.params,...technicians]};result=await execute(env.DB,actor as any,command,input,guard)}
   else if(command==='connector.save')result=await saveSecret(env,actor,auth.authority,input)
   else if(command==='connector.revoke')result=await revokeSecret(env,actor,auth.authority,input)
   else if(command==='booking.revokeLink')result=await revokeBookingLink(env,actor,auth.authority,input)
   else if(command==='checkin.issue')result=await createCheckInLink(env,actor,auth.authority,input)
   else if(command==='intakeForm.create')result=await createIntakeFormLink(env,actor,auth.authority,input)
   else if(['purchase.compare','purchase.submit','purchase.reconcile','purchase.cancel','purchase.rejectSubstitution'].includes(command))result=await supplierDoor(env,actor,auth.authority,command,input)
   else if(command==='refund.submit'||command==='refund.reconcile')result=await refundDoor(env,actor,auth.authority,command,input)
   else if(command==='payment.verifyStripe')result=await verifyStripePayment(env,actor,auth.authority,input)
   else if(command==='flow.collect'){if(input.termsAssignmentId)auth.authority=requireStepUp(auth);const checked=await collectionInput(env,actor,input,auth.authority);result=await execute(env.DB,actor as any,command,checked.input,checked.authority);await purgeIntakeSecrets(env,'job_id=?',[input.jobId])}
   else if(['intake.secretStore','intake.secretReveal','intake.secretEnd','intake.secretEraseCustomer'].includes(command))result=await intakeSecret(env,actor,auth.authority,command,input)
   else if(command.startsWith('statusNotice.'))result=await statusNoticeCommand(env,actor,auth.authority,command,input)
   else if(command.startsWith('review.'))result=await reviewCommand(env,actor,auth.authority,command,input)
   else if(command.startsWith('outreach.'))result=await outreachCommand(env,actor,auth.authority,command,input)
   else if(command.startsWith('routing.'))result=await routingCommand(env.DB,actor as any,auth.authority,command,input)
   else if(command==='promise.approveAndNotify')result=await sendPromiseNotice(env,actor,auth.authority,input)
   else if(command==='approvalLink.create'){if(!human(actor))throw new HttpError(403,'manager_required');result=await sendApprovalLink(env,actor,auth.authority,input)}
   else if(command.startsWith('agent.')) result=await agentKey(env.DB,actor,auth.authority,command,input)
   else if(command==='asset.erase') {
    if(actor.role!=='owner')throw new HttpError(403,'owner_required')
    if(input.confirm!=='ERASE')throw new HttpError(400,'confirmation_required')
    const checkpoint=await imports.portabilityCheckpoint(env.DB)
    result=await imports.erase(env.DB,actor,input.assetId,auth.authority,{nativeStatements:[{sql:"DELETE FROM mallet_records WHERE kind='event' AND json_extract(value,'$.assetId')=? AND json_extract(value,'$.jobId') IS NULL",params:[input.assetId]}],checkpoint})
   } else if(command==='diagnosisLink.create'){if(!human(actor))throw new HttpError(403,'manager_required');result=await createLink(env.DB,actor,auth.authority,input,env.AUTH_ORIGIN)}
   else if(['diagnosis.record','intake.record'].includes(command)&&actor.role!=='agent'){if(command==='intake.record'&&!human(actor))throw new HttpError(403,'manager_required');const checked=await diagnosisInput(env.DB,actor,auth.authority,input);result=await execute(env.DB,actor as any,command,checked.input,checked.authority)}
   else if(['crew.add','handoff.propose','note.add'].includes(command)&&actor.role!=='agent'){
    // FLOW-004: people named in a command are resolved here against active operators; client claims are discarded.
    const people=(await operators(env.DB)).list.filter(o=>o.status==='active'),one=(id:unknown)=>people.find(o=>o.id===id)
    if(command==='note.add'){const checked=await diagnosisInput(env.DB,actor,auth.authority,{...input,attachmentIds:input.attachmentIds??[]});result=await execute(env.DB,actor as any,command,{...checked.input,mentions:[...new Set(Array.isArray(input.mentionIds)?input.mentionIds:[])].map(id=>one(id)??{id,role:'none'}).map((o:any)=>({id:o.id,name:o.name??'',role:o.role}))},checked.authority)}
    else{const tech=one(command==='crew.add'?input.technicianId:input.toId);result=await execute(env.DB,actor as any,command,{...input,verifiedTechnician:tech?.role==='member',toName:tech?.name},auth.authority)}
   }
   else if(command==='inspection.record'&&actor.role!=='agent'){const checked=await inspectionRecordInput(env.DB,actor,auth.authority,input);result=await execute(env.DB,actor as any,command,checked.input,checked.authority)}
   else result=await execute(env.DB,actor as any,command,input,auth.authority)
   if(actor.role!=='owner')result=withoutFleetApproval(result)
   if(actor.staff){if(isApi)return json(result);return redirect('/app/staff')}
   if(command.startsWith('staff.')){if(isApi)return json(result);return redirect('/app/staff-access')}
   if(isApi){if(!human(actor)&&result&&typeof result==='object'&&'billing' in result){const {billing,...rest}=result;result=rest}return json(actor.role==='agent'?withoutSubletCosts(withoutInspectionSource(result)):result)}
   if(retentionCommands.includes(command)){if(command==='customer.export')return new Response(JSON.stringify(result,null,2),{headers:{...headers,'content-type':'application/json','content-disposition':'attachment; filename="customer-data.json"'}});return page('Retention & erasure',retentionPage(await load(env.DB),input.customerId??'',command==='retention.preview'?result:undefined,input,['customer.erase','retention.run'].includes(command)?result:undefined),actor,200,{section:'data'})}
   if(['invoice.issue','invoice.send'].includes(command)){const invoiceId=command==='invoice.issue'?input.invoiceId:result.invoiceId;return redirect('/app/invoices/'+encodeURIComponent(invoiceId))}
   if(command.startsWith('ar.'))return redirect('/app/receivables?'+new URLSearchParams({accountId:String(input.accountId??'')}))
   if(command==='tender.clearance'||command==='tax.creditBasis')return redirect('/app/tax/filing')
   if(command.startsWith('deposit.'))return redirect('/app/deposits?'+new URLSearchParams({accountId:String(input.accountId??'')}))
   if(command==='customer.mergePreview')return page('Review duplicate merge',mergePreviewPage(result,input),actor,200,{section:'customers'})
   if(command==='inspectionReport.send')return page('Inspection report email',`<section class="card"><p>${e(result.status==='accepted'?'Handed to the mail provider; delivery is not confirmed.':result.status==='development'?'Saved to the development outbox; not sent.':'Send failed or is uncertain. Contact the customer; no automatic retry will occur.')}</p><a href="${e(result.url)}">Open reviewed customer report</a><p><a href="/app/jobs/${e(result.jobId)}#inspection-reports">Return to repair</a></p></section>`,actor,200,{section:'jobs'})
   if(command.startsWith('calendar.')||command.startsWith('waitlist.'))return redirect('/app/calendar')
   if(command==='promise.timeZone'&&input.calendarReturn)return redirect('/app/calendar')
   if(command==='booking.attendance')return redirect('/app/reports/turnaround?'+new URLSearchParams({from:String(input.from??''),to:String(input.to??'')}))
   if(command==='decline.inapplicable')return redirect('/app/jobs/'+encodeURIComponent(String(input.jobId)))
   if(command.startsWith('statusNotice.'))return redirect('/app/jobs/'+encodeURIComponent(String(result.jobId??input.jobId))+'/notifications')
   if(command.startsWith('review.'))return redirect('/app/jobs/'+encodeURIComponent(String(result.jobId??input.jobId))+'/reviews')
   if(command.startsWith('outreach.'))return redirect(input.returnTo==='receivables'?'/app/receivables?accountId='+encodeURIComponent(String(input.accountId)):input.returnTo==='declined'?'/app/jobs/'+encodeURIComponent(String(input.jobId)):'/app/bookings')
   if(command==='booking.publish'||command==='booking.revokeLink')return redirect('/app/bookings')
   if(command.startsWith('connector.'))return redirect('/app/connectors')
   if(command==='checkin.issue')return page('Customer check-in link',`<section class="card"><p>Share this private seven-day, one-request link directly with the customer. No message, booking or payment has been sent. Anyone holding the link can use it.</p><a href="${e(result.url)}">Open customer check-in</a><pre>${e(result.url)}</pre><p><a href="/app/check-ins">Return to check-in queue</a></p></section>`,actor,200,{section:'jobs'})
   if(command==='checkin.confirm'||command==='checkin.revoke')return redirect('/app/check-ins')
   if(command==='intakeForm.create')return page('Customer intake link',`<section class="card"><p>Share this private seven-day link directly with this customer. Mallet has not sent it. Anyone holding it can use it; it will not be shown again.</p><a href="${e(result.url)}">Open customer intake form</a><pre>${e(result.url)}</pre><a href="/app/jobs/${e(input.jobId)}/intake">Return to custody</a></section>`,actor,200,{section:'jobs'})
   if(command==='intakeForm.publish')return redirect('/app/intake-templates')
   if(command==='intakeForm.revoke')return redirect(`/app/jobs/${e(input.jobId)}/intake`)
   if(command==='intake.secretReveal')return page('Temporary unlock secret',`<section class="card"><p>Use only for the recorded purpose. Close this page after use, then end the purpose.</p><pre>${e(result.secret)}</pre><a href="/app/jobs/${e(input.jobId)}/intake">Return to custody</a></section>`,actor,200,{section:'jobs'})
   if(command.startsWith('intake.'))return redirect(`/app/jobs/${e(input.jobId)}/intake`)
   if(command.startsWith('return.')||command==='payment.verifyStripe'||command==='flow.collect')return redirect(`/app/jobs/${e(input.jobId)}/return`)
   if(command==='payment.record'&&input.returnTo==='return')return redirect(`/app/jobs/${e(input.jobId)}/return`)
   if(command.startsWith('warranty.')||command==='payment.record')return redirect(`/app/jobs/${e(command==='warranty.open'?result.jobId:input.jobId)}/warranty`)
   if(command==='assistant.grant')return page('Scoped assistant key',`<section class="card"><p>Copy this separate key once into the assistant’s private environment.</p><pre>${e(result.token)}</pre><p>Allowed action: ${e(result.kind)}. Zero spend. Expires ${when(result.expiresAt)}.</p><a href="/app/settings/assistants">Return to assistant settings</a></section>`,actor,200,{section:'data'})
   if(command.startsWith('assistant.'))return redirect('/app/settings/assistants')
   if(command==='agent.create'||command==='agent.rotate')return page('Agent key created',`<section class="card"><p>Copy this key once into your agent’s private environment. It will not be shown again.</p><pre>${e(result.token)}</pre><p>Expires ${when(new Date(result.expiresAt).toISOString(),undefined,'date-year')}</p><p class="card-foot"><a href="/app/data">Return to access</a></p></section>`,actor,200,{section:'data'})
   if(command==='asset.erase')return redirect('/app/customers')
   if(command==='approvalLink.create')return page('Approval link sent',`<section class="card"><p>${e(result.delivery?.status==='accepted'?'Handed to the mail provider for '+result.to+'; delivery is not confirmed.':result.delivery?.status==='development'?'Written to the development mail outbox for '+result.to+'; not sent.':'The mail provider did not accept the message for '+result.to+'.')}</p><p>If the customer cannot find the email, share this link yourself. It will not be shown again.</p><pre>${e(result.url)}</pre><p class="card-foot"><a href="/app/jobs/${e(result.jobId)}#approval-links">Return to the repair</a></p></section>`,actor,200,{section:'jobs'})
   if(command==='diagnosisLink.create')return page('Customer inspection link',`<section class="card"><p>Copy this read-only link to the customer yourself. Mallet has not sent it, and it will not be shown again.</p><pre>${e(result.url)}</pre><p>Expires ${when(result.expiresAt)}</p><p class="card-foot"><a href="/app/jobs/${e(result.jobId)}#diagnosis">Return to the repair</a></p></section>`,actor,200,{section:'jobs'})
   if(command==='agent.revoke')return redirect('/app/data')
   if(['tax.certificate','tax.assignJurisdiction','tax.suppliesRule','tax.discountRule','tax.adjustEstimate'].includes(command))return redirect('/app/tax/custody')
   if(command==='tax.configure')return redirect('/app/tax?saved=1')
   if(command==='handoff.decline')return redirect('/app/jobs')
   if(['chasePolicy.save','chaseOptOut.record','chaseOptOut.lift'].includes(command)||command==='chaseTask.resolve'&&!input.jobId)return redirect('/app/approvals#'+(command==='chasePolicy.save'?'chase-policy':command==='chaseTask.resolve'?'chase-tasks':'chase-opt-outs'))
   if(command==='approvalChase.recordReply'||command==='chaseTask.resolve')return redirect(`/app/jobs/${encodeURIComponent(String(input.jobId))}#approval-links`)
   if(command==='specialPart.review')return redirect('/app/jobs#special-part-notices')
   if(command==='promise.timeZone')return redirect('/app/jobs#promise-plan')
   if(command.startsWith('time.')&&!input.jobId)return redirect('/app/time')
   // The saved rate is shown in the period the owner was reviewing, not silently today's.
   if(command.startsWith('reportFilter.'))return redirect('/app/reports/'+(result.report==='technicians'?'technicians':'turnaround')+'?'+new URLSearchParams({from:result.from,to:result.to}))
   if(command==='costRate.set')return redirect('/app/settings/profitability#cost-'+encodeURIComponent(input.technicianId))
   if(command==='payRate.set')return redirect('/app/reports/technicians?'+new URLSearchParams({from:String(input.from??''),to:String(input.to??'')})+'#tech-'+encodeURIComponent(input.technicianId))
   if(command==='rateProfile.save')return redirect('/app/jobs#rate-profiles')
   if(command.startsWith('customer.')||command.startsWith('contact.'))return redirect('/app/accounts?manage=all')
   if(command.startsWith('purchase.')&&(input.returnTo==='suppliers'||['purchase.compare','purchase.cart','purchase.submit','purchase.reconcile','purchase.rejectSubstitution','purchase.cancel'].includes(command)))return redirect('/app/purchasing/suppliers')
   if(command.startsWith('purchase.'))return redirect('/app/purchasing')
   if(command==='stock.lot'&&input.returnTo==='supplier-returns')return redirect('/app/inventory/returns')
   if(['stock.catalog','stock.lot','stock.useLot'].includes(command))return redirect('/app/inventory/trace')
   if(command==='stock.location'||command.startsWith('stock.transfer'))return redirect('/app/inventory/transfers')
   if(command.startsWith('stock.rma'))return redirect('/app/inventory/returns')
   if(command.startsWith('stock.core'))return redirect('/app/inventory/cores')
   if(['stock.replenishment','stock.replenish'].includes(command))return redirect('/app/inventory/replenishment')
   if(command.startsWith('stock.'))return redirect('/app/inventory')
   if(command==='asset.create'||command==='asset.update')return redirect(`/app/assets/${result.id}`)
   const jobId=command==='job.book'?result.id:input.jobId??result.jobId??(command==='invoice.export'?rows(await load(env.DB),'invoice').find(i=>i.id===input.invoiceId)?.jobId:undefined)
   return redirect(jobId?`/app/jobs/${jobId}`:'/app')
  }
  if(path==='/app/backup' && request.method==='POST') {
   if(actor.role!=='owner')throw new HttpError(403,'owner_required')
   const service=await createPortability({db:env.DB,policy}),id=await service.exports.create(actor.id)
   let status=await service.exports.advance(id,{maxParts:1})
   while(status.phase!=='complete')status=await service.exports.advance(id,{expectedPart:status.completed,maxParts:1})
   return new Response(await service.exports.download(id),{headers:{...headers,'content-type':'application/x-ndjson','content-disposition':'attachment; filename="workshop.rer"'}})
  }
  if(request.method!=='GET' && request.method!=='HEAD')throw new HttpError(405,'method_not_allowed')
  const state=visible(await load(env.DB),actor)
  if(path==='/app/retention'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');return page('Retention & erasure',retentionPage(state,url.searchParams.get('customerId')??''),actor,200,{section:'data'})}
  if(path==='/api/mallet/catalogue'){if(actor.role==='member')throw new HttpError(403,'manager_required');return json(await catalogue(env,await connectorSecret(env,'pier','PIER_SESSION')))}
  if(path==='/app/calendar'){if(!human(actor))throw new HttpError(403,'manager_required');return page('Resource calendar',calendarPage(state,(await operators(env.DB)).names,url.searchParams),actor,200,{section:'jobs'})}
  if(path==='/app/bookings'){if(!human(actor))throw new HttpError(403,'manager_required');return page('Online appointments',bookingStaff(state,(await operators(env.DB)).names,actor.role==='owner'),actor,200,{section:'jobs'})}
  if(path==='/api/mallet/state')return json({actor,...state})
  if(path==='/api/mallet/board')return json(repairBoard(state,new Date().toISOString(),boardFilter(url.searchParams)))
  const invoicePage=path.match(/^\/app\/invoices\/([^/]+)$/)
  if(invoicePage){if(actor.role!=='owner')throw new HttpError(403,'owner_required');const invoice=rows(state,'invoice').find(i=>i.id===invoicePage[1]);if(!invoice||invoice.status==='draft')throw new HttpError(404,'not_found');return page('Issued invoices',invoiceDocumentsPage(state,invoice),actor,200,{section:'jobs'})}
  const documentPath=path.match(/^\/(app|api\/mallet)\/invoice-documents\/([^/.]+)(\.pdf|\.txt|\/print)$/)
  if(documentPath){if(actor.role!=='owner')throw new HttpError(403,'owner_required');const d=rows(state,'invoiceDocument').find(d=>d.id===documentPath[2]);if(!d)throw new HttpError(404,'not_found');if(documentPath[3]==='/print')return page('Issued invoice',documentHtml(d),actor,200,{section:'jobs'});const pdf=documentPath[3]==='.pdf';return new Response(pdf?Uint8Array.from(atob(d.pdfBase64),c=>c.charCodeAt(0)):d.content,{headers:{...headers,'content-type':pdf?'application/pdf':'text/plain; charset=utf-8','content-disposition':'attachment; filename="'+d.number+(pdf?'.pdf':'.txt')+'"'}})}
  const receiptMatch=path.match(/^\/api\/mallet\/approval-receipts\/([^/]+)$/)
  if(receiptMatch)return json(approvalReceipt(state,actor,receiptMatch[1]))
  const exportMatch=path.match(/^\/api\/mallet\/exports\/([^/]+)$/)
  if(exportMatch){if(!human(actor))throw new HttpError(403,'manager_required');const x=rows(state,'export').find(x=>x.id===exportMatch[1]);if(!x)throw new HttpError(404,'not_found');return csv(x.csv,'mallet-invoice')}
  const historyMatch=path.match(/^\/api\/mallet\/assets\/([^/]+)\/history.csv$/)
  if(historyMatch)return csv(assetHistoryCsv(state,historyMatch[1]),'mallet-service-history')
  const counts:Counts={board:waiting(state).total,jobs:rows(state,'job').filter(j=>repair(state,j).column!=='closed').length},frame=(section:Section,more={})=>({section,counts,...more})
  if(path==='/app'){const board=shopBoard(state,actor,(await operators(env.DB)).names,url.searchParams.get('ro'),boardFilter(url.searchParams));return page('Shop Board',taxNotice(state,actor)+board.body.replace('id="board"',`id="board" data-board-version="${state.version}"`).replace('class="empty-board"',`class="empty-board" data-board-version="${state.version}"`),actor,200,frame('board',{subtitle:board.subtitle,aside:board.aside,liveBoard:true}))}
  if(['/api/mallet/reports/profitability','/app/reports/profitability','/app/settings/profitability'].includes(path)) {
   if(actor.role!=='owner')throw new HttpError(403,'owner_required')
   if(request.method!=='GET')throw new HttpError(405,'get_required')
   const source=await load(env.DB),names=(await operators(env.DB)).names
   if(path==='/app/settings/profitability')return page('Profitability settings',profitabilitySettings(rows(source,'costRate'),names),actor,200,frame('jobs'))
   if(url.searchParams.has('format')&&url.searchParams.get('format')!=='json')throw new HttpError(400,'invalid_report_format')
   const report=profitabilityReport(source,url.searchParams)
   if(!await env.DB.prepare(`SELECT 1 AS ok WHERE (${auth.authority.sql})`).bind(...auth.authority.params).first())throw new HttpError(403,'owner_required')
   return path.startsWith('/api/')?json(report):page('Repair profitability',profitabilityPage(report,names),actor,200,frame('jobs'))
  }
  if(path==='/api/mallet/reports/turnaround'||path==='/app/reports/turnaround') {
   if(actor.role==='agent')throw new HttpError(403,'staff_required')
   const format=reportFormat(url.searchParams),now=new Date().toISOString()
   const report=turnaroundReport(state,period(url.searchParams.get('from'),url.searchParams.get('to'),now),now,actor.role!=='member')
   if(path.startsWith('/app/'))return page('Turnaround and promises',turnaroundPage(report,actor.role==='owner',await reportFilterView(env,actor,rows(state,'reportFilter'))),actor,200,frame('jobs'))
   if(format==='xlsx')return xlsx(turnaroundCsv(report),`mallet-turnaround-${report.period.from}-${report.period.to}`)
   return format==='csv'?csv(turnaroundCsv(report),`mallet-turnaround-${report.period.from}-${report.period.to}`):json(report)
  }
  if(path==='/api/mallet/reports/technicians'||path==='/app/reports/technicians') {
   if(actor.role==='agent')throw new HttpError(403,'staff_required')
   const report=technicianReport(await load(env.DB),actor,period(url.searchParams.get('from'),url.searchParams.get('to'),new Date().toISOString()))
   if(path.startsWith('/api/')){const format=reportFormat(url.searchParams);return format==='xlsx'?xlsx(technicianCsv(report),`mallet-technicians-${report.period.from}-${report.period.to}`):format==='csv'?csv(technicianCsv(report),`mallet-technicians-${report.period.from}-${report.period.to}`):json(report)}
   return page('Technician efficiency',technicianReportPage(report,actor,(await operators(env.DB)).names,await reportFilterView(env,actor,rows(state,'reportFilter'))),actor,200,frame('jobs',{subtitle:'Sold versus actual hours, productivity and attendance, recomputed from clock events.'}))
  }
  if(/^\/api\/mallet\/accounts\/[^/]+\/billing$/.test(path)){
   if(!human(actor))throw new HttpError(403,'manager_required')
   const id=path.split('/')[4],account=rows(state,'customerAccount').find(a=>a.id===id&&!a.mergedInto)
   if(!account)throw new HttpError(404,'not_found')
   const ids=new Set([id,...rows(state,'customerAccount').filter(a=>a.mergedInto===id).map(a=>a.id)])
   return json(rows(state,'invoice').filter(i=>ids.has(i.billing?.accountId)))
  }
  if(path==='/app/receivables'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');return page('Commercial receivables',receivablesPage(state,url.searchParams.get('accountId')??'',utcDate(url.searchParams.get('asOf')??new Date().toISOString().slice(0,10))),actor,200,frame('customers'))}
  if(path==='/app/tax/filing'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');const today=new Date().toISOString().slice(0,10);return page('Filing-period tax preview',filingPage(state,url.searchParams.get('from')??today.slice(0,8)+'01',url.searchParams.get('to')??today),actor,200,frame('tax'))}
  if(path==='/api/mallet/tax/filing'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');return json(filingTax(state,url.searchParams.get('from'),url.searchParams.get('to')))}
  if(path==='/api/mallet/receivables'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');return json(accountStatement(state,url.searchParams.get('accountId')??'',utcDate(url.searchParams.get('asOf')??new Date().toISOString().slice(0,10))))}
  if(path==='/app/deposits'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');return page('Deposits & customer credit',depositsPage(state,url.searchParams.get('accountId')??''),actor,200,frame('customers'))}
  if(path==='/app/accounts'){
   if(!human(actor))throw new HttpError(403,'manager_required')
   const manage=url.searchParams.get('manage'),q=url.searchParams.get('q')??''
   const account=manage&&manage!=='all'?rows(state,'customerAccount').find(a=>a.id===manage&&!a.mergedInto):null
   if(manage!=='all'&&!account)throw new HttpError(404,'not_found')
   const result=account?{accounts:[account],nextCursor:null,total:1}:await searchAccounts(env.DB,actor,auth.authority,q,url.searchParams.get('cursor')??undefined)
   return page('Customer accounts',(actor.role==='owner'?'<p><a href="/app/deposits">Deposits & customer credit</a> · <a href="/app/receivables">Commercial receivables</a></p>':'')+accountsPage(state,q,result),actor,200,frame('customers'))
  }
  if(['/app/purchasing/suppliers','/api/mallet/supplier-orders'].includes(path)){if(!human(actor))throw new HttpError(403,'manager_required');return path.startsWith('/api/')?json(supplierOrderReport(state)):page('Supplier stock & ordering',supplierOrdersPage(state),actor,200,frame('inventory'))}
  if(['/app/purchasing','/api/mallet/purchasing'].includes(path)){if(!human(actor))throw new HttpError(403,'manager_required');return path.startsWith('/api/')?json(rows(state,'purchaseOrder').map(po=>({...po,...purchaseStatus(state,po)}))):page('Purchase orders',purchasingPage(state),actor,200,frame('inventory'))}
  if(['/app/inventory/transfers','/api/mallet/transfers'].includes(path)){if(!human(actor))throw new HttpError(403,'manager_required');return path.startsWith('/api/')?json(transferReport(state)):page('Inter-store stock transfers',transfersPage(state),actor,200,frame('inventory'))}
  if(['/app/inventory/returns','/api/mallet/supplier-returns'].includes(path)){if(!human(actor))throw new HttpError(403,'manager_required');return path.startsWith('/api/')?json(rmaReport(state)):page('Supplier returns & quarantine',rmasPage(state),actor,200,frame('inventory'))}
  if(['/app/inventory/cores','/api/mallet/cores'].includes(path)){if(!human(actor))throw new HttpError(403,'manager_required');return path.startsWith('/api/')?json(coreReport(state,undefined,actor.role==='owner')):page('Core deposits & returns',coresPage(state,actor.role==='owner'),actor,200,frame('inventory'))}
  if(['/app/inventory/replenishment','/api/mallet/replenishment'].includes(path)){if(!human(actor))throw new HttpError(403,'manager_required');return path.startsWith('/api/')?json(replenishmentReport(state)):page('Replenishment',replenishmentPage(state),actor,200,frame('inventory'))}
  if(['/app/inventory/trace','/api/mallet/trace'].includes(path)){if(!human(actor))throw new HttpError(403,'manager_required');const q=url.searchParams.get('q')??'';return path.startsWith('/api/')?json(traceReport(state,q)):page('Parts catalog & traceability',tracePage(state,q),actor,200,frame('inventory'))}
  if(['/app/inventory','/app/inventory/count','/api/mallet/inventory'].includes(path)){if(!human(actor))throw new HttpError(403,'manager_required');if(path.startsWith('/api/'))return json(stockReport(state));return page(path.endsWith('/count')?'Blind stock count':'Stock & receiving',path.endsWith('/count')?countPage():inventoryPage(state),actor,200,frame('inventory'))}
  if(path==='/app/time'){if(actor.role==='agent')throw new HttpError(403,'staff_required');return page('Time & attendance',`<div class="narrow">${timePanel(state,actor,(await operators(env.DB)).names)}</div>`,actor,200,frame('jobs'))}
  if(path==='/app/check-ins'){if(!human(actor))throw new HttpError(403,'manager_required');return page('Counter & after-hours check-ins',checkInQueuePage(state,(await operators(env.DB)).list,actor),actor,200,frame('jobs'))}
  if(path==='/app/jobs'){const names=(await operators(env.DB)).names;return page('Repair orders',(actor.role!=='agent'?waitingForMe(state,actor)+(human(actor)?'<p><a href="/app/bookings">Online appointments</a> · <a href="/app/check-ins">Counter & after-hours check-in queue</a></p>':'')+'<p><a href="/app/time">My time & attendance</a> · <a href="/app/reports/technicians">Technician efficiency</a> · <a href="/app/reports/turnaround">Turnaround and promises</a>'+(actor.role==='owner'?' · <a href="/app/reports/profitability">Repair profitability</a>':'')+'</p>':'')+(human(actor)?rateProfilePanel(state,''):'')+specialPartNotices(state,actor)+promisePlan(state,actor,names)+repairOrders(state,names),actor,200,frame('jobs',{subtitle:'Open repair orders by start time, then invoiced visits.'}))}
  if(path==='/app/customers')return page('Customers',customers(state,actor,url.searchParams.get('type')??'vehicle'),actor,200,frame('customers',{subtitle:'Every customer’s asset and its visits.'}))
  if(path==='/app/approvals')return page('Approvals',(human(actor)?chasePage(state):'')+approvals(state),actor,200,frame('approvals',{subtitle:'Every price, dispatch plan and invoice a person approved, at its exact revision.'}))
  if(path==='/app/tax/custody'||path==='/api/mallet/tax/report'){if(actor.role!=='owner')throw new HttpError(403,'owner_required');return path.startsWith('/api/')?json(jurisdictionReport(state)):page('Tax certificates & invoice report',taxCustodyPage(state),actor,200,frame('tax'))}
  if(path==='/app/tax'){if(!human(actor))throw new HttpError(403,'manager_required');return page('Shop sales tax',`<div class="narrow">${taxPage(state,url.searchParams.has('saved'))}</div>`,actor,200,frame('tax',{subtitle:'The sales tax rate Mallet applies to new estimates, in USD.'}))}
  if(path==='/app/move-in')return page('Move into Mallet',moveIn(actor),actor,200,frame('move-in'))
  if(path==='/app/data'){if(!human(actor))throw new HttpError(403,'manager_required');const keys=await env.DB.prepare('SELECT id,label,expires_at,revoked_at FROM mallet_agent_keys ORDER BY created_at DESC').all();return page('Data & access',dataPage(actor,keys.results),actor,200,frame('data'))}
  if(path==='/app/backup')throw new HttpError(405,'post_required')
  if(path==='/app/intake-templates'){if(!human(actor))throw new HttpError(403,'manager_required');return page('Intake templates',intakeTemplatesPage(state),actor,200,frame('jobs'))}
  const signedFormMatch=path.match(/^\/app\/intake-forms\/([^/]+)\/print$/)
  if(signedFormMatch){if(!human(actor))throw new HttpError(403,'manager_required');const doc=rows(state,'intakeForm').find(f=>f.id===signedFormMatch[1]);if(!doc?.receipt)throw new HttpError(404,'not_found');return page('Original signed intake',`<div class="narrow">${signedIntakeReceipt(doc.receipt,doc.copy)}</div>`,actor,200,frame('jobs'))}
  const handoverMatch=path.match(/^\/app\/handovers\/([^/]+)\/print$/)
  if(handoverMatch){if(!human(actor))throw new HttpError(403,'manager_required');const receipt=rows(state,'handover').find(r=>r.id===handoverMatch[1]);if(!receipt)throw new HttpError(404,'not_found');return page('Handover receipt',`<div class="narrow">${handoverReceipt(receipt)}</div>`,actor,200,frame('jobs'))}
  const noticesMatch=path.match(/^\/app\/jobs\/([^/]+)\/notifications$/)
  if(noticesMatch){if(actor.role!=='owner')throw new HttpError(403,'owner_required');const job=rows(state,'job').find(j=>j.id===noticesMatch[1]);if(!job)throw new HttpError(404,'not_found');return page('Status & pickup',statusNoticePage(await statusNoticeState(env,state,actor),job),actor,200,frame('jobs'))}
  const reviewMatch=path.match(/^\/app\/jobs\/([^/]+)\/reviews$/)
  if(reviewMatch){if(actor.role!=='owner')throw new HttpError(403,'owner_required');const job=rows(state,'job').find(j=>j.id===reviewMatch[1]);if(!job)throw new HttpError(404,'not_found');return page('Review & satisfaction',`<div class="narrow"><p><a href="/app/jobs/${e(job.id)}/return">Back to documented handover</a></p>${reviewPanel(await reviewState(env,state,actor),job,actor)}</div>`,actor,200,frame('jobs'))}
  const returnMatch=path.match(/^\/app\/jobs\/([^/]+)\/return$/)
  if(returnMatch){if(!human(actor))throw new HttpError(403,'manager_required');const job=rows(state,'job').find(j=>j.id===returnMatch[1]);if(!job)throw new HttpError(404,'not_found');return page('Documented handover',returnPage(await reviewState(env,state,actor),job,actor),actor,200,frame('jobs'))}
  const warrantyMatch=path.match(/^\/app\/jobs\/([^/]+)\/warranty$/)
  if(warrantyMatch){if(!human(actor))throw new HttpError(403,'manager_required');const job=rows(state,'job').find(j=>j.id===warrantyMatch[1]);if(!job)throw new HttpError(404,'not_found');return page('Warranty & comeback work',warrantyPage(state,job,(await operators(env.DB)).list),actor,200,frame('jobs'))}
  const intakeMatch=path.match(/^\/app\/jobs\/([^/]+)\/intake$/)
  if(intakeMatch){if(!human(actor))throw new HttpError(403,'manager_required');const job=rows(state,'job').find(j=>j.id===intakeMatch[1]);if(!job)throw new HttpError(404,'not_found');await expireIntakeSecrets(env);const secrets=actor.role==='owner'?(await env.DB.prepare('SELECT id,purpose,expires_at FROM mallet_intake_secrets WHERE job_id=? ORDER BY expires_at').bind(job.id).all()).results:[];return page('Condition & custody',intakePage(state,job,actor,await diagnosisMedia(env.DB,actor,auth.authority,job.id),secrets),actor,200,frame('jobs'))}
  const previewMatch=path.match(/^\/app\/jobs\/([^/]+)\/media\/view\/([^/]+)$/)
  if(previewMatch){const job=rows(state,'job').find(j=>j.id===previewMatch[1]);if(!job)throw new HttpError(404,'not_found');const {row}=await uploadScope(env.DB,actor,auth.authority,previewMatch[2]);if(row.job_id!==job.id||!row.complete)throw new HttpError(404,'not_found');return page('Inspection evidence',mediaPreview(job,uploadView(row)),actor,200,frame('jobs',{subtitle:e(job.title),media:true}))}
  const mediaMatch=path.match(/^\/app\/jobs\/([^/]+)\/media$/)
  if(mediaMatch){if(actor.role==='agent')throw new HttpError(403,'manager_required');const job=rows(state,'job').find(j=>j.id===mediaMatch[1]);if(!job)throw new HttpError(404,'not_found');return page('Inspection photos & video',mediaPage(job),actor,200,frame('jobs',{subtitle:e(job.title)+' · '+e(job.asset.label),media:true}))}
  const asset=path.match(/^\/app\/assets\/([^/]+)$/),job=path.match(/^\/app\/jobs\/([^/]+)$/)
  const people=asset||job?await operators(env.DB):undefined
  const photos=job&&actor.role!=='agent'&&rows(state,'inspection').some(i=>i.jobId===job[1])?await inspectionPhotos(env.DB,actor,auth.authority,job[1]):[]
  const view=asset?assetPage(state,asset[1],actor,people!.names,people!.list,Object.fromEntries(bookingFields.filter(k=>url.searchParams.has(k)).map(k=>[k,url.searchParams.get(k)!.slice(0,200)]))):job?jobPage(state,job[1],actor,people!.names,photos,job&&actor.role!=='agent'?await diagnosisMedia(env.DB,actor,auth.authority,job[1]):[],people!.list):null
  if(view)return page(view.title,view.body,actor,200,frame(asset?'customers':'jobs',{subtitle:view.subtitle}))
  const print=path.match(/^\/app\/estimates\/([^/]+)\/print$/)
  if(print){const estimate=rows(state,'estimate').find(x=>x.id===print[1]);if(!estimate)throw new HttpError(404,'not_found');const rev=estimate.revisions.at(-1);return page('Repair estimate',`<section class="card print-sheet"><p class="sub">${estimate.supplementOf?`Supplement ${e(estimate.sequence)} · incremental scope · `:''}Revision ${e(rev.n)} · ${status(estimate.status)}</p>${estimate.supplementOf?`<p>${e(estimate.reason)}</p><p>Prior accepted scope and completed work remain unchanged. Decide only the incremental lines below.</p>`:''}<ul class="list">${rev.lines.map((l:any)=>`<li class="plain"><span class="row-name">${e(l.description)}</span><span class="row-meta">${e(l.quantity)} × ${money(l.unitCents-(l.unitDiscountCents??0))} before tax · ${lineTax(l)}</span></li>`).join('')}</ul>${invoiceTotals(rev.totals)}<p>Tell the shop exactly which lines you authorize. The shop records your decision and its evidence against this revision.</p></section>`,actor,200,frame('jobs'))}
  throw new HttpError(404,'not_found')
 } catch(error:any) {
  const kitCode=error instanceof Error && /^[A-Z][A-Z0-9_]{1,100}$/.test(error.message)?error.message:null
  const known=error instanceof HttpError || error instanceof MalletError || typeof error?.code==='string' || !!kitCode,status=known?(error.status??409):500,code=error.code??kitCode??'operation_failed'
  if(isApi)return json({error:code,message:known?error.message:'The operation failed.',details:error instanceof MalletError?error.details:undefined},status)
  if(code==='second_factor_required'||code==='step_up_required') {
   // A person is taken to confirm, then returns to the page they were on to repeat the action.
   const input=submitted?.input??{},back=request.method==='GET'?path+url.search:String(submitted?.command).startsWith('ar.')?'/app/receivables?'+new URLSearchParams({accountId:String(input.accountId??'')}):submitted?.command==='tender.clearance'?'/app/tax/filing':String(submitted?.command).startsWith('deposit.')?'/app/deposits?'+new URLSearchParams({accountId:String(input.accountId??'')}):typeof input.jobId==='string'?'/app/jobs/'+encodeURIComponent(input.jobId):retentionCommands.includes(String(submitted?.command))?'/app/retention':String(submitted?.command).startsWith('agent.')?'/app/data':submitted?.command==='asset.erase'?'/app/customers':'/app'
   return redirect('/app/security?'+(code==='step_up_required'?'stepUp=1&':'')+'returnTo='+encodeURIComponent(back))
  }
  if(status===401)return redirect('/signin?returnTo='+encodeURIComponent(path))
  const clashes=error instanceof MalletError&&error.code==='DISPATCH_CONFLICT'?error.details?.conflicts:null
  if(Array.isArray(clashes)&&submitted) {
   const {command,input}=submitted,names=(await operators(env.DB)).names
   const back=command==='job.book'?{href:`/app/assets/${encodeURIComponent(String(input.assetId))}?${new URLSearchParams(bookingFields.filter(k=>typeof input[k]==='string').map(k=>[k,input[k]]))}#book`,label:'Back to the booking form'}:{href:`/app/jobs/${encodeURIComponent(String(rows(await load(env.DB),'proposal').find(p=>p.id===input.proposalId)?.jobId))}`,label:'Back to the job'}
   return page('Booking conflict',conflictPage(clashes,names,back),actor,status,{section:command==='job.book'?'customers':'jobs'})
  }
  if(status===404&&code==='not_found')return page('Page not found',notFound(),actor,404,{section:null,heading:false})
  if(error instanceof MalletError&&error.code==='QUALITY_BLOCKED'&&Array.isArray(error.details?.blockers)) {
   const jobId=error.details.jobId??submitted?.input?.jobId
   return page('Quality clearance needed',`<section class="card"><p>${e(error.message)}</p><ul>${error.details.blockers.map((b:any)=>`<li>${e(b.reason)}</li>`).join('')}</ul>${jobId?`<p><a href="/app/jobs/${encodeURIComponent(String(jobId))}#quality">Return to this repair’s quality checks</a></p>`:''}</section>`,actor,status,{section:'jobs'})
  }
  if(error instanceof MalletError&&['SUBLET_CUSTODY','SUBLET_BILL','SUBLET_WORK'].includes(error.code)&&submitted?.input?.jobId) {
   const jobId=String(submitted.input.jobId)
   return page('Sublet work needs review',`<section class="card"><p>${e(error.message)}</p><p><a href="/app/jobs/${encodeURIComponent(jobId)}#sublets">Return to this repair’s sublet work</a></p></section>`,actor,status,{section:'jobs'})
  }
  const details=error instanceof MalletError&&error.details?`<pre>${e(JSON.stringify(error.details,null,2))}</pre>`:''
  return page('Could not complete that action',refused(known?errorMessage(code,error.message):'The action could not be completed. Check what you entered and try again.',details,path.startsWith('/app/move-in')),actor,status,{section:path.startsWith('/app/move-in')?'move-in':path==='/app/data'?'data':path==='/app/tax'?'tax':path.startsWith('/app/actions')?'board':null})
 }
}
