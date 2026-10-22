import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { buildSearchProjection } from '../../src/mallet/read-model/search-projection.mjs'

export const declaredCapacity = Object.freeze({ shops:10, customersPerShop:30000, vehiclesPerShop:40000, repairOrdersPerShopPerYear:8000, historyYears:7, photosPerRepairOrder:25, videosPerRepairOrder:1, stockedSkusPerShop:2500, staffSessionsPerShop:30, installationStaffSessions:300, openCustomerLinks:50, totalRepairOrders:560000, totalPhotos:14000000, totalVideos:560000 })
const at='2026-10-23T00:00:00.000Z'
export const syntheticId=(kind,n)=>`synthetic-mallet-capacity-${kind}-${String(n).padStart(8,'0')}`
const uuid=(kind,n)=>{const s=createHash('sha256').update(syntheticId(kind,n)).digest('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-8${s.slice(17,20)}-${s.slice(20,32)}`}
const actor={id:syntheticId('historical-actor',1),name:'Synthetic capacity fixture operator',role:'owner'}
const record=(kind,value)=>({kind,id:value.id,revision:value.version,value:JSON.stringify(value)})
const contact=n=>({id:syntheticId('contact',n),version:1,name:`Synthetic capacity customer ${n}`,email:`synthetic-mallet-${n}@example.test`,phone:`+1 202 555 ${String(n).padStart(6,'0')}`,communication:'none',notes:'Synthetic capacity fixture; no real person.',history:[],by:actor,at})
const account=n=>({id:syntheticId('account',n),version:1,payerRevision:1,name:`Synthetic capacity customer ${n}`,kind:'person',contactIds:[syntheticId('contact',n)],payerId:syntheticId('contact',n),billingContactId:syntheticId('contact',n),driverId:null,authorizerId:null,taxStatus:'standard',notes:'Synthetic capacity fixture.',history:[],mergedInto:null,by:actor,at})
// Fixture identifiers only; this assigns no real manufacturer/vehicle identity.
// Check-digit weights: https://www.nhtsa.gov/sites/nhtsa.dot.gov/files/fmvss/VIN_Final_Rule_April_08.pdf
export function searchIdentifier(n){
 if(!Number.isSafeInteger(n)||n<1||n>999999)throw new Error('Invalid synthetic vehicle ordinal.')
 if(n%2)return 'S'+String(n).padStart(6,'0')
 const raw='1ZZAA00A0TA'+String(n).padStart(6,'0'),weights=[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2]
 const groups=['','AJ','BKS','CLT','DMU','ENV','FW','GPX','HY','RZ']
 const value=c=>/^[0-9]$/.test(c)?Number(c):groups.findIndex(chars=>chars.includes(c))
 const remainder=[...raw].reduce((sum,c,i)=>sum+value(c)*weights[i],0)%11
 return raw.slice(0,8)+(remainder===10?'X':String(remainder))+raw.slice(9)
}
const asset=(n,spec)=>{
 const visits=[];for(let i=n;i<=spec.repairOrders;i+=spec.vehicles)visits.push(syntheticId('job',i))
 return {id:syntheticId('asset',n),version:1,customerAccountId:syntheticId('account',(n-1)%spec.customers+1),customerName:`Synthetic capacity customer ${(n-1)%spec.customers+1}`,customerEmail:`synthetic-mallet-${(n-1)%spec.customers+1}@example.test`,driverContactId:null,label:`Synthetic capacity vehicle ${n}`,identifier:spec.identifierFormat==='plate-and-vin'?searchIdentifier(n):`SYNTHETIC-CAPACITY-${n}`,visits,createdAt:'2019-01-01T00:00:00.000Z'}
}
export function* businessRecords(spec,{searchOnly=false}={}){
 for(let n=1;n<=spec.vehicles;n++)yield record('asset',asset(n,spec))
 for(let n=1;n<=spec.customers;n++)yield record('contact',contact(n))
 for(let n=1;n<=spec.customers;n++)yield record('customerAccount',account(n))
 if(searchOnly)return
 for(let n=1;n<=spec.repairOrders;n++){
  const vehicle=asset((n-1)%spec.vehicles+1,spec),startAt=new Date(Date.UTC(2019,0,1)+Math.floor((n-1)*7*365/spec.repairOrders)*86400000+((n-1)%30)*3600000).toISOString(),endAt=new Date(Date.parse(startAt)+3600000).toISOString()
  yield record('job',{id:syntheticId('job',n),version:1,assetId:vehicle.id,asset:{customerName:vehicle.customerName,customerEmail:vehicle.customerEmail,label:vehicle.label,identifier:vehicle.identifier},title:`Synthetic canceled RO ${n}`,notes:'Test-only historical cancellation before any repair authorization.',technicianId:syntheticId('historical-staff',(n-1)%30+1),bayId:`Synthetic bay ${(n-1)%30+1}`,startAt,endAt,status:'canceled',estimateId:null,invoiceId:null,actuals:[],createdAt:startAt,bookedBy:actor,closure:{outcome:'canceled',reason:'Synthetic capacity fixture: customer canceled before approving work.',stage:'intake',by:actor,at:endAt}})
 }
 for(let n=1;n<=spec.stockedSkus;n++)yield record('stockItem',{id:syntheticId('sku',n),version:1,sku:`SYNTHETIC-SKU-${n}`,barcode:`SYNTHETIC-BARCODE-${n}`,name:`Synthetic capacity part ${n}`,unit:'each',by:actor,at})
}

export async function capacityDataset({scale='smoke',shops=1,identifierFormat='synthetic',photoPath=new URL('../../tests/fixtures/dvi/front-brake.png',import.meta.url),videoPath=new URL('../../tests/fixtures/dvi/synthetic-inspection.webm',import.meta.url),...overrides}={}){
 if(shops!==1)throw new Error('Unsupported multi-shop dataset: Mallet has no shop identity or isolation model. Declared OPS-002 requires ten shops; this generator supports one shop only.')
 if(!['synthetic','plate-and-vin'].includes(identifierFormat))throw new Error('Unknown fixture identifier format.')
 if(!['smoke','single-shop'].includes(scale))throw new Error('Choose smoke or single-shop.')
 const spec={shops:1,customers:scale==='single-shop'?30000:6,vehicles:scale==='single-shop'?40000:8,repairOrders:scale==='single-shop'?56000:10,photosPerRepairOrder:scale==='single-shop'?25:1,videosPerRepairOrder:1,stockedSkus:scale==='single-shop'?2500:5,...overrides}
 if(Object.keys(overrides).some(k=>!['customers','vehicles','repairOrders','photosPerRepairOrder','videosPerRepairOrder','stockedSkus'].includes(k)))throw new Error('Unknown dataset option.')
 for(const [key,value] of Object.entries(spec))if(!Number.isSafeInteger(value)||value<(key==='photosPerRepairOrder'||key==='videosPerRepairOrder'||key==='stockedSkus'?0:1))throw new Error('Invalid dataset count: '+key)
 if(identifierFormat!=='synthetic')spec.identifierFormat=identifierFormat
 const photo=await readFile(photoPath),video=await readFile(videoPath)
 if(!photo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||photo.length>8388608)throw new Error('Photo must be a real PNG of at most 8 MiB.')
 if(!video.subarray(0,4).equals(Buffer.from([26,69,223,163]))||video.length>33554432)throw new Error('Video must be a real WebM of at most 32 MiB.')
 const media=[{bytes:photo,mime:'image/png',filename:'synthetic-repeated-inspection.png'},{bytes:video,mime:'video/webm',filename:'synthetic-repeated-inspection.webm'}].map(m=>({...m,sha256:createHash('sha256').update(m.bytes).digest('hex')}))
 function* observations(){
  const per=spec.photosPerRepairOrder+spec.videosPerRepairOrder
  for(let job=1;job<=spec.repairOrders;job++)for(let n=0;n<per;n++){
   const number=(job-1)*per+n+1,clip=n>=spec.photosPerRepairOrder,m=media[clip?1:0],findingId=uuid('finding',number),uploadId=uuid('upload',number),clientId=uuid('finding-client',number),uploadClient=uuid('upload-client',number),jobId=syntheticId('job',job)
   const finding={id:findingId,job_id:jobId,client_id:clientId,title:`Synthetic repeated ${clip?'video':'photo'} ${n+1}`,captured_at:at,created_at:at,actor_json:JSON.stringify(actor),request_json:JSON.stringify({jobId,clientId,title:`Synthetic repeated ${clip?'video':'photo'} ${n+1}`,capturedAt:at})}
   const request={findingId,variant:'original',originalId:null,filename:m.filename,mime:m.mime,size:m.bytes.length,sha256:m.sha256,capturedAt:at,annotations:null}
   const upload={id:uploadId,finding_id:findingId,job_id:jobId,variant:'original',original_id:null,filename:m.filename,mime:m.mime,size:m.bytes.length,sha256:m.sha256,captured_at:at,received_at:at,actor_json:JSON.stringify(actor),annotations_json:null,request_json:JSON.stringify(request),complete:1,completed_at:at}
   yield {finding,upload,client:{finding_id:findingId,client_id:uploadClient,upload_id:uploadId},media:m}
  }
 }
 function* rowsFor(name){
  if(name==='mallet_records'){yield*businessRecords(spec);return}
  if(['mallet_search_documents','mallet_search_grams','mallet_search_members'].includes(name)){
   let docId=1
   for(const record of businessRecords(spec,{searchOnly:true})){
    const projection=buildSearchProjection([record],docId);docId+=projection.mallet_search_documents.length
    yield*projection[name]
   }
   return
  }
  if(!['mallet_media_findings','mallet_media_uploads','mallet_media_upload_clients','mallet_media_chunks'].includes(name))return
  for(const o of observations()){
   if(name==='mallet_media_findings')yield o.finding
   if(name==='mallet_media_uploads')yield o.upload
   if(name==='mallet_media_upload_clients')yield o.client
   if(name==='mallet_media_chunks')for(let ordinal=0;ordinal<Math.ceil(o.media.bytes.length/65536);ordinal++){
    const bytes=o.media.bytes.subarray(ordinal*65536,(ordinal+1)*65536)
    yield {upload_id:o.upload.id,ordinal,sha256:createHash('sha256').update(bytes).digest('hex'),byte_length:bytes.length,base64:bytes.toString('base64')}
   }
  }
 }
 const count=spec.repairOrders*(spec.photosPerRepairOrder+spec.videosPerRepairOrder),rawMediaBytes=spec.repairOrders*(spec.photosPerRepairOrder*photo.length+spec.videosPerRepairOrder*video.length)
 return {spec,rowsFor,report:{fixture:'synthetic-mallet-capacity',scope:'single shop only; canceled historical repairs without fabricated approvals, work, invoices or payments',declaredCapacity,generated:spec,media:{photos:spec.repairOrders*spec.photosPerRepairOrder,videos:spec.repairOrders*spec.videosPerRepairOrder,findings:count,photoBytes:photo.length,videoBytes:video.length,rawMediaBytes,repeatedSyntheticBytes:true},unsupported:['ten-shop identity and isolation','300 native concurrent staff sessions','50 live customer links','authorized/completed repair, estimate and invoice histories','server p95 performance and restart proof (must be measured separately)']}}
}
