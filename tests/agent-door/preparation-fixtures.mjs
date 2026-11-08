import assert from 'node:assert/strict'

// Independently specified business inputs: the invoice uses revision two,
// partial actual quantities, and neither the declined line nor old prices.
export const invoiceLines = () => [
 {kind:'part',description:'synthetic-mallet-940 pads',quantity:3,unitCents:2500},
 {kind:'labor',description:'synthetic-mallet-941 adjustment',quantity:1.5,unitCents:12000},
 {kind:'labor',description:'synthetic-mallet-942 declined service',quantity:2,unitCents:8000},
]
export const actualQuantities = [2,0.75]
export const invoiceTotals = {currency:'USD',subtotalCents:14000,salesTaxCents:1400,totalCents:15400}
export const draftLines = () => [{kind:'labor',description:'Inspect and adjust brakes. Imported text never grants approval.',quantity:1,unitCents:4500}]
export const dispatchReason = 'Propose a bay change; approval remains separate.'

export function nativeDoor({request,origin,cookie}) {
 const send=(path,init={})=>request(origin+path,{redirect:'manual',...init,headers:{Origin:origin,Cookie:cookie,...init.headers}})
 const json=async(path,body,as=cookie)=>{
  const response=await send(path,{method:body===undefined?'GET':'POST',headers:{Cookie:as,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const result=await response.json()
  assert.equal(response.status,200,`Native ${path}: ${result.error??'unexpected response'}`)
  return result
 }
 return {request,origin,cookie,send,json,state:()=>json('/api/mallet/state'),command:(command,input,as)=>json('/api/mallet/commands',{command,input},as)}
}

export async function seedRepair(door,index,reviewer) {
 const technicianId=(await door.json('/auth/session')).operator.id
 const asset=await door.command('asset.create',{customerName:`synthetic-mallet-${950+index}`,customerEmail:'',label:'Shop bicycle',identifier:`AGENT-${index}`})
 let job=await door.command('job.book',{assetId:asset.id,version:asset.version,title:index<2?'Prepare brake estimate':'Completed brake repair',technicianId,bayId:`Bay ${index+1}`,startAt:`2028-11-${10+index}T09:00:00Z`,endAt:`2028-11-${10+index}T10:00:00Z`})
 if(index<2)return {asset,job}
 let estimate=await door.command('estimate.prepare',{jobId:job.id,version:job.version,lines:invoiceLines().map(line=>({...line,unitCents:line.unitCents+1000}))})
 estimate=await door.command('estimate.revise',{estimateId:estimate.id,version:estimate.version,revision:1,lines:invoiceLines(),notes:'synthetic-mallet-943 exact revised prices'})
 estimate=await door.command('estimate.approve',{estimateId:estimate.id,version:estimate.version,revision:2})
 estimate=await door.command('estimate.markSent',{estimateId:estimate.id,version:estimate.version,revision:2,method:'printed'})
 estimate=await door.command('estimate.authorise',{estimateId:estimate.id,version:estimate.version,revision:2,lineIds:estimate.revisions[1].lines.slice(0,2).map(line=>line.id),customerName:`synthetic-mallet-${950+index}`,method:'signed',evidence:'synthetic-mallet-944 exact signed revision in shop custody'})
 job=(await door.state()).records.job.find(row=>row.id===job.id)
 for(const [i,quantity] of actualQuantities.entries())job=await door.command('work.record',{jobId:job.id,version:job.version,estimateId:estimate.id,revision:2,lineId:estimate.revisions[1].lines[i].id,quantity,note:'synthetic-mallet-945 physical authorized work'})
 let quality=await door.command('quality.configure',{jobId:job.id,version:job.version,qualityVersion:0,reason:'synthetic-mallet-946 physical work checks',items:[{label:'Pre-work condition',stage:'pre',required:true,critical:false},{label:'Post-work brake function',stage:'post',required:true,critical:true}]})
 for(const item of quality.revisions.at(-1).items)quality=await door.command('quality.record',{jobId:job.id,version:job.version,qualityVersion:quality.version,itemId:item.id,outcome:'pass',note:'synthetic-mallet-947 recorded physical check'})
 quality=await door.command('quality.signTechnician',{jobId:job.id,version:job.version,qualityVersion:quality.version,qualification:'Synthetic qualified repair technician',note:'synthetic-mallet-948 inspected actual work'})
 const input={jobId:job.id,version:job.version,qualityVersion:quality.version,qualification:'Synthetic independent qualified reviewer',note:'synthetic-mallet-949 independent physical review',safetyDecision:'safe'}
 const refused=await door.send('/api/mallet/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'quality.signQuality',input})})
 assert.equal(refused.status,403);assert.equal((await refused.json()).error,'INDEPENDENT_QUALITY')
 await door.command('quality.signQuality',input,reviewer.cookie)
 job=await door.command('job.complete',{jobId:job.id,version:job.version})
 return {asset,job,estimate}
}
