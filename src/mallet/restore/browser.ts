import {MAX_LINE_BYTES} from '@runeditrun/rer/modules/portability/format'
export const RESTORE_SCRIPT=String.raw`(()=>{
const form=document.querySelector('[data-restore]');if(!form)return;
const status=form.querySelector('[role=status]'),button=form.querySelector('button');
async function api(path,body,method='POST'){
 const response=await fetch('/api/portability/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Restore refused');return result;
}
async function* lines(file){
 const reader=file.stream().pipeThrough(new TextDecoderStream()).getReader();let pending='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;pending+=value;let end;
  while((end=pending.indexOf('\n'))!==-1){const line=pending.slice(0,end);pending=pending.slice(end+1);if(line.trim())yield JSON.parse(line)}
  if(pending.length>${MAX_LINE_BYTES})throw Error('An archive line exceeds the supported size.');
 }if(pending.trim())yield JSON.parse(pending)}finally{await reader.cancel();reader.releaseLock()}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();const archive=form.querySelector('[name=archive]').files[0],journal=form.querySelector('[name=journal]').files[0],unverified=form.querySelector('[name=unverified]').checked;
 if(!archive){status.textContent='Choose the workshop archive.';return}
 if(!journal&&!unverified){status.textContent='Supply your latest archive as the journal, or explicitly accept erasure history unverified.';return}
 button.disabled=true;status.textContent='Checking and staging the archive. No repair is published until verification completes.';let id;
 try{
  let laterJournal;
  if(journal){for await(const record of lines(journal)){if(record.kind!=='manifest')throw Error('The journal must begin with its archive manifest.');laterJournal={sourceIdentity:record.sourceIdentity,epoch:record.epoch,journal:record.journal};break}}
  let trailer,parts=0;
  for await(const record of lines(archive)){
   if(!id){if(record.kind!=='manifest')throw Error('The archive must begin with its manifest.');id=(await api('imports',{manifest:record,confirmed:true})).id;continue}
   if(record.kind==='part'){await api('imports/'+id+'/parts/'+record.index,record,'PUT');parts++;status.textContent='Staged '+parts+' archive parts; verifying before publication.'}
   else trailer=record;
  }
  if(!trailer?.archiveHash)throw Error('The archive has no final integrity record.');
  const result=await api('imports/'+id+'/finalize',{archiveHash:trailer.archiveHash,contentHash:trailer.contentHash,...(laterJournal?{laterJournal}:{})});
  status.textContent='Restored. '+result.erasureNotice;form.querySelector('[data-finish]').hidden=false;
 }catch(error){status.textContent='Restore refused: '+error.message+'. The original shop was not changed.';if(id)await api('imports/'+id+'/abort',{}).catch(()=>{})}
 finally{button.disabled=false}
});
})();`
