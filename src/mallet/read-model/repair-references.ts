import type {Row} from '../model'
import {HttpError} from '../auth'

const ids:Record<string,string[]>={
 assetId:['asset'],estimateId:['estimate'],invoiceId:['invoice'],customerAccountId:['customerAccount'],customerId:['customerAccount'],
 payerId:['contact'],billingContactId:['contact'],driverId:['contact'],authorizerId:['contact'],
 templateId:['inspectionTemplate','intakeTemplate'],recipeId:['inspectionJob'],matrixId:['pricingMatrix'],rateProfileId:['rateProfile'],
 lotId:['stockLot'],itemId:['stockItem'],binId:['stockBin'],receiptId:['stockReceipt','purchaseReceipt'],purchaseReceiptId:['purchaseReceipt'],purchaseOrderId:['purchaseOrder'],
 termsId:['warrantyTerms'],reportId:['inspectionReport'],inspectionId:['inspection'],entryId:['timeEntry'],declinedWorkId:['declinedWork']
}
const snapshots:Record<string,string>={template:'inspectionTemplate',recipe:'inspectionJob',mappedRecipe:'inspectionJob',pricedRecipe:'inspectionJob',matrix:'pricingMatrix',rateProfile:'rateProfile'}
const jobKeys=new Set(['jobId','originalJobId','correctiveJobId','reworkJobId','dependencyJobId','sourceJobId'])
/** Follow explicit identifiers, never actor IDs or arbitrary strings that resemble IDs. */
export function repairReferences(row:Row){
 const jobs=new Set<string>(),records=new Map<string,[string,string]>()
 const add=(kind:string,id:unknown)=>{if(typeof id==='string'&&id.length>0&&id.length<=200)records.set(kind+'\x00'+id,[kind,id])}
 const visit=(value:unknown,depth=0)=>{
  if(depth>64)throw new HttpError(413,'repair_graph_too_large')
  if(Array.isArray(value)){value.forEach(item=>visit(item,depth+1));return}
  if(!value||typeof value!=='object')return
  for(const [key,entry] of Object.entries(value)){
   if(jobKeys.has(key)&&typeof entry==='string')jobs.add(entry)
   for(const kind of ids[key]??[])add(kind,entry)
   if(key==='contactIds'&&Array.isArray(entry))entry.forEach(id=>add('contact',id))
   if(snapshots[key]&&entry&&typeof entry==='object'&&!Array.isArray(entry))add(snapshots[key],(entry as {id?:unknown}).id)
   visit(entry,depth+1)
  }
 }
 visit(row)
 return {jobs:[...jobs],records:[...records.values()]}
}
