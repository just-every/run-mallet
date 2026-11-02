import assert from 'node:assert/strict'
import { installation, archive } from '../harness.mjs'
import { creditAccountFixture,creditInvoice } from './refunds-journey.mjs'
import { readEmptyTemplate, capacityArchive } from '../../scripts/capacity/archive.mjs'
import { importCapacity } from '../../scripts/capacity/import.mjs'
import { makePart, ContentVerifier, ArchiveVerifier } from '@runeditrun/rer/modules/portability/format'

// Keep native integrity checks intact: adversarial business graphs have valid
// archive, part and content digests, so only product graph validation can refuse.
async function* changedArchive(lines,change){
 let content,archive
 for await(const line of lines){
  if(line.kind==='manifest'){content=new ContentVerifier(line);archive=new ArchiveVerifier(line);yield line}
  else if(line.kind==='part'){
   const items=structuredClone(line.items)
   for(const item of items)if(item.kind==='row')change(item.table,item.row)
   const part=await makePart(line.index,items)
   for(const item of items)content.add(item)
   archive.add(part);yield part
  }else yield {...line,contentHash:content.digest(),archiveHash:archive.digest()}
 }
}

/** One public-door journey, registered by tests/mallet.test.mjs. No direct
 * database writes, staged-policy calls, auth shortcuts or production fixtures. */
export async function capacityImportJourney(){
 const source=await installation(),fresh=await installation()
 try{
  const template=await readEmptyTemplate((async function*(){for(const line of await archive(source))yield Buffer.from(JSON.stringify(line)+'\n')})())
  const fixture=await capacityArchive(template,{customers:2,vehicles:2,repairOrders:2,photosPerRepairOrder:1,videosPerRepairOrder:1,stockedSkus:2})
  let replacedGram=false
  const mutations=[
   ['search gram',(table,row)=>{if(table==='mallet_search_grams'&&!replacedGram){row.gram='☃☃☃';replacedGram=true}}],
   ['search membership',(table,row)=>{if(table==='mallet_search_members')row.contact_id='missing-contact'}],
   ['unknown kind',(table,row)=>{if(table==='mallet_records'&&row.kind==='job')row.kind='unknownRepair'}],
   ['status',(table,row)=>{if(table==='mallet_records'&&row.kind==='job'){const value=JSON.parse(row.value);value.status='invented';row.value=JSON.stringify(value)}}],
   ['dangling asset',(table,row)=>{if(table==='mallet_records'&&row.kind==='job'){const value=JSON.parse(row.value);value.assetId='missing';row.value=JSON.stringify(value)}}],
   ['payer scope',(table,row)=>{if(table==='mallet_records'&&row.kind==='customerAccount'){const value=JSON.parse(row.value);value.payerId='missing';row.value=JSON.stringify(value)}}],
   ['media job',(table,row)=>{if(table==='mallet_media_uploads')row.job_id='missing'}],
   ['media bytes',(table,row)=>{if(table==='mallet_media_chunks'&&row.ordinal===0)row.base64='AAAA'+row.base64.slice(4)}]
  ]
  for(const [label,change]of mutations){
   let importId
   const request=async(path,options)=>{
    const response=await fresh.request(path,options)
    if(path==='/api/portability/imports'&&response.status===201)importId=(await response.clone().json()).id
    return response
   }
   await assert.rejects(()=>importCapacity(changedArchive(fixture.lines(),change),request),/Native import refused \(409\): mallet_graph:/,label)
   assert.equal((await fresh.state()).records.job,undefined,'refused graph publishes no ROs')
   assert.equal((await fresh.api('/api/mallet/media/findings?jobId=missing',undefined,{status:404})).error!==undefined,true)
   await fresh.api(`/api/portability/imports/${importId}/abort`,{})
  }
  const result=await importCapacity(fixture.lines(),fresh.request)
  assert.equal(result.phase,'complete')
  const state=await fresh.state()
  assert.equal(state.records.job.length,2)
  assert.equal(state.records.asset.length,2)
  assert.equal(state.records.customerAccount.length,2)
  assert.equal(state.records.stockItem.length,2)
  assert.equal(state.records.estimate,undefined,'fixture cannot fabricate repair authority')
  const native=await archive(fresh)
  const media=native.flatMap(line=>line.kind==='part'?line.items:[]).filter(item=>item.kind==='row'&&item.table==='mallet_media_uploads')
  assert.equal(media.length,4)
  const bytes=await fresh.request(`/api/mallet/media/uploads/${media[0].row.id}/content`)
  assert.equal(bytes.status,200)
  assert.equal((await bytes.arrayBuffer()).byteLength,media[0].row.size)
  assert.notEqual(state.actor.id,(await source.state()).actor.id,'restoration retains fresh native authority')
  await assert.rejects(()=>capacityArchive(template,{shops:10}),/Unsupported multi-shop/)
  // A genuine authorized invoice is internally rebalanced to a new price,
  // including its approval/export amounts. Archive hashes and arithmetic are
  // valid; the frozen original estimate must still reject the invented price.
  const {account}=await creditAccountFixture(source)
  await creditInvoice(source,account)
  const financial=await archive(source),destination=await installation()
  try{
   const change=(table,row)=>{
    if(table!=='mallet_records'||!['invoice','export'].includes(row.kind))return
    const value=JSON.parse(row.value)
    Object.assign(value.lines[0],{unitCents:102,subtotalCents:306,salesTaxCents:23,totalCents:329})
    value.totals={currency:'USD',subtotalCents:506,salesTaxCents:38,totalCents:544}
    if(value.approval)value.approval.totals=structuredClone(value.totals)
    row.value=JSON.stringify(value)
   }
   await assert.rejects(()=>importCapacity(changedArchive(financial,change),destination.request),/Native import refused \(409\): mallet_graph:finance_invoice_frozen_price/)
   assert.equal((await destination.state()).records.invoice,undefined,'a rebalanced invoice cannot invent a new approved price')
  }finally{await destination.close()}
 }finally{await fresh.close();await source.close()}
}
