import assert from 'node:assert/strict'
import {makePart,ContentVerifier,ArchiveVerifier} from '@runeditrun/rer/modules/portability/format'
import {installation,restore} from '../harness.mjs'

async function changedArchive(lines,change){
 const result=[],content=new ContentVerifier(lines[0]),archive=new ArchiveVerifier(lines[0])
 for(const line of lines){
  if(line.kind==='part'){
   const items=structuredClone(line.items)
   for(const item of items)if(item.kind==='row'&&item.table==='mallet_records'){
    const row=JSON.parse(item.row.value);change(item.row.kind,row);item.row.value=JSON.stringify(row)
   }
   const part=await makePart(line.index,items);for(const item of items)content.add(item);archive.add(part);result.push(part)
  }else if(line.kind==='manifest')result.push(line)
  else result.push({...line,contentHash:content.digest(),archiveHash:archive.digest()})
 }
 return result
}

// Recompute native digests so only the product graph can reject the forged history.
export async function refuseBlockerArchives(backup){
 for(const change of [
  (kind,row)=>{if(kind==='repairBlockerTask')row.packetId='synthetic-mallet-990'},
  (kind,row)=>{if(kind==='repairBlockerPacket'&&row.revisions[0].sources.diagnostics.length)row.revisions[0].sources.diagnostics[0].href='javascript:alert(1)'},
  (kind,row)=>{if(kind==='repairBlockerPacket'&&row.revisions[0].sources.diagnostics.length)row.revisions[0].sources.diagnostics[0].revision=9999}
 ]){
  const fresh=await installation()
  try{
   const result=await restore(fresh,await changedArchive(backup,change),{status:409})
   assert.match(result.error,/^mallet_graph:blocker_/,'ADV-003 malformed packet history is refused by product validation')
   assert.equal((await fresh.state()).records.repairBlockerPacket,undefined,'ADV-003 refused archive publishes no blocker history')
  }finally{await fresh.close()}
 }
}
