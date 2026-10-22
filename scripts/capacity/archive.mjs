import { canonicalJson, sha256 } from '@runeditrun/rer/modules/portability'
import { FORMAT, makePart, ContentVerifier, ArchiveVerifier, readArchive } from '@runeditrun/rer/modules/portability/format'
import { capacityDataset } from './dataset.mjs'

/** Small EMPTY installation export supplies the authoritative native schema,
 * migration history and excluded inventory. Never invent or relax schema. */
export function byteStream(source){
 if(typeof source.getReader==='function')return source
 const iterator=source[Symbol.asyncIterator]()
 return new ReadableStream({async pull(controller){const value=await iterator.next();if(value.done)controller.close();else controller.enqueue(value.value)},async cancel(){await iterator.return?.()}})
}
export async function readEmptyTemplate(source){
 const retained=new Map();let manifest,closing=false
 for await(const line of readArchive(byteStream(source))){
  if(line.kind==='manifest'){
   manifest=line
   if(manifest.product!=='workshop/mallet'||manifest.epoch!==0||manifest.journal.length||manifest.objects.length||manifest.payloads.length||manifest.tables.reduce((n,t)=>n+t.count,0)>1000)throw new Error('Use a native export from an empty Mallet installation.')
  }else if(line.kind==='part')for(const item of line.items){
   if(item.kind!=='row')throw new Error('Template must not contain binary payloads.')
   if(!['mallet_meta','mallet_records'].includes(item.table)||item.table==='mallet_records'&&item.row.kind!=='taxSettings')throw new Error('Template contains business records; use an empty installation.')
   const items=retained.get(item.table)??[];items.push(item.row);retained.set(item.table,items)
  }else if(line.kind==='closing')closing=true
 }
 if(!manifest||!closing)throw new Error('A complete native export is required.')
 return {manifest,retained}
}

// Native portability permits at most 1,000 row items per authenticated part.
const PART_BYTES=1024*1024,PART_ROWS=1000
async function* parts(items,{hashed=true}={}){
 let batch=[],bytes=100,index=0
 for(const item of items()){
  const size=Buffer.byteLength(canonicalJson(item))+1
  if(size>PART_BYTES-256)throw new Error('Synthetic row exceeds the bounded capacity part size.')
  if(batch.length&&(bytes+size>PART_BYTES||batch.length>=PART_ROWS)){
   yield hashed?await makePart(index,batch):{index};index++;batch=[];bytes=100
  }
  batch.push(item);bytes+=size
 }
 if(batch.length)yield hashed?await makePart(index,batch):{index}
}

export async function capacityArchive(template,options={}){
 const dataset=await capacityDataset(options),{manifest:base,retained}=template
 const names=new Set(base.tables.map(t=>t.name))
 for(const required of ['mallet_records','mallet_media_findings','mallet_media_uploads','mallet_media_upload_clients','mallet_media_chunks'])if(!names.has(required))throw new Error('Current native template is missing '+required)
 const counts=new Map(base.tables.map(t=>[t.name,0]))
 const items=function*(){
  for(const table of base.tables){let index=0
   for(const row of retained.get(table.name)??[])yield {kind:'row',table:table.name,index:index++,row}
   for(const row of dataset.rowsFor(table.name))yield {kind:'row',table:table.name,index:index++,row}
   counts.set(table.name,index)
  }
 }
 // A bounded first pass determines authenticated inventory and partCount. A
 // second deterministic pass writes bytes. Memory never grows with RO count.
 let partCount=0;for await(const ignored of parts(items,{hashed:false}))partCount++
 const tables=base.tables.map(t=>({...t,count:counts.get(t.name)}))
 const manifest={...base,kind:'manifest',format:FORMAT,version:2,sourceIdentity:'synthetic-mallet-capacity-single-shop',exportedAt:'2026-10-23T00:00:00.000Z',tables,schema:await sha256(canonicalJson(tables.map(({name,sql})=>({name,sql})))),epoch:0,journal:[],partCount,capacityFixture:dataset.report}
 async function* lines(){
  yield manifest
  const content=new ContentVerifier(manifest),archive=new ArchiveVerifier(manifest)
  for await(const part of parts(items)){archive.add(part);for(const item of part.items)content.add(item);yield part}
  yield {kind:'closing',partCount,contentHash:content.digest(),archiveHash:archive.digest()}
 }
 return {manifest,report:dataset.report,lines}
}
