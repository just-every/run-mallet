import{test}from'node:test'
import assert from'node:assert/strict'
import{installation,booking,authorise,archive}from'../../tests/harness.mjs'
import{supplementJourney}from'../../tests/support/supplement-journey.mjs'
import{importCapacity}from'./import.mjs'
import{makePart,ContentVerifier,ArchiveVerifier}from'@runeditrun/rer/modules/portability/format'
test('authorized replacement capacity is checked before any actual work',async()=>{
 const source=await installation(),target=await installation()
 try{
  await source.command('tax.configure',{ratePercent:0,partsTaxable:true,laborTaxable:true})
  let{job}=await booking(source)
  const root=await authorise(source,await source.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{id:'synthetic-mallet-201',kind:'part',description:'Synthetic source part',quantity:2,unitCents:100}]}))
  job=(await source.state()).records.job.find(r=>r.id===job.id)
  const supplement=await authorise(source,await source.command('estimate.prepare',{jobId:job.id,version:job.version,supplement:true,reason:'Customer reviews prospective replacement',lines:[{id:'synthetic-mallet-202',kind:'part',description:'Synthetic prospective replacement',quantity:1,unitCents:100,replaces:{estimateId:root.id,revision:1,lineId:'synthetic-mallet-201'}}]}))
  const original=await archive(source)
  async function* changed(){let content,hash
   for(const record of original){
    if(record.kind==='manifest'){content=new ContentVerifier(record);hash=new ArchiveVerifier(record);yield record}
    else if(record.kind==='part'){
     const items=structuredClone(record.items)
     for(const item of items)if(item.table==='mallet_records'&&item.row.kind==='estimate'&&item.row.id===supplement.id){const value=JSON.parse(item.row.value),rev=value.revisions[0];Object.assign(rev.lines[0],{quantity:3,quantityMilli:3000,subtotalCents:300,salesTaxCents:0,totalCents:300});rev.lines[0].replaces.quantityMilli=3000;rev.totals={currency:'USD',subtotalCents:300,salesTaxCents:0,totalCents:300};value.authorisation.totals=structuredClone(rev.totals);item.row.value=JSON.stringify(value)}
     const part=await makePart(record.index,items);hash.add(part);for(const item of items)content.add(item);yield part
    }else yield{...record,archiveHash:hash.digest(),contentHash:content.digest()}
   }
  }
  await assert.rejects(()=>importCapacity(changed(),target.request),/Native import refused \(409\): mallet_graph:finance_replacement_cap/)
  assert.equal((await target.state()).records.job,undefined)
 }finally{await source.close();await target.close()}
})
test('genuine prospective replacements and frozen invoice restore',supplementJourney)
