/** Public native HTTP import only. Caller supplies an authenticated request
 * function so session credentials never enter an archive or a report. */
export async function importCapacity(lines,request,{laterJournal,onProgress=()=>{}}={}){
 let id,completed=0
 async function json(path,method,body){
  const response=await request(path,{method,body})
  const value=await response.json()
  if(!response.ok)throw new Error(`Native import refused (${response.status}): ${value.error??'operation_failed'}`)
  return value
 }
 for await(const line of lines){
  if(line.kind==='manifest'){
   if(id)throw new Error('Duplicate manifest.')
   const started=await json('/api/portability/imports','POST',{manifest:line,confirmed:true});id=started.id
  }else if(line.kind==='part'){
   if(!id)throw new Error('Manifest required before parts.')
   await json(`/api/portability/imports/${id}/parts/${line.index}`,'PUT',line)
   onProgress({completed:++completed,phase:'staging'})
  }else if(line.kind==='closing'){
   if(!id)throw new Error('Manifest required before closing.')
   const result=await json(`/api/portability/imports/${id}/finalize`,'POST',{archiveHash:line.archiveHash,contentHash:line.contentHash,...(laterJournal?{laterJournal}:{})})
   onProgress({completed,phase:'complete'})
   return result
  }else throw new Error('Unexpected native archive record.')
 }
 throw new Error('Native archive closing record missing.')
}
