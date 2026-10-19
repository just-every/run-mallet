export const editorCode=String.raw`
const findSelect=root.querySelector('[name=findingId]'),titleInput=root.querySelector('[name=findingTitle]'),timeInput=root.querySelector('[name=capturedAt]');
const findingKey='mallet.media.'+root.dataset.jobId+'.finding';let findings=[];
timeInput.value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el};
const selectedFinding=()=>findings.find(f=>f.id===findSelect.value);
const formatTime=value=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
async function loadFindings(){
 findings=(await api('/findings?jobId='+encodeURIComponent(root.dataset.jobId))).findings;
 const chosen=findSelect.value||localStorage.getItem(findingKey+'Id');findSelect.replaceChildren(new Option('Choose a finding',''));
 for(const f of findings)findSelect.add(new Option(f.title,f.id));if(findings.some(f=>f.id===chosen))findSelect.value=chosen;
 const list=root.querySelector('[data-findings]');list.replaceChildren();
 if(!findings.length)list.append(node('p','No inspection evidence saved for this repair yet.','muted'));
 for(const f of findings){
  const article=node('article',undefined,'evidence-item');article.append(node('h3',f.title));
  article.append(node('p','Reported capture: '+formatTime(f.capturedAt)+' · '+f.by.name,'meta'));observationText(article,f);
  for(const m of f.media){
   const item=node('div',undefined,'media-version');const name=m.variant==='original'?'Original (immutable)':'Prepared shared version · private';
   item.append(node('span',name,'badge '+(m.variant==='original'?'gray':'blue')));
   item.append(node('p',m.filename+' · '+m.size.toLocaleString()+' bytes','meta'));
   item.append(node('p','Reported capture '+formatTime(m.capturedAt)+' · received '+formatTime(m.receivedAt)+' · '+m.by.name,'meta'));
   if(!m.complete){item.append(node('p','Upload incomplete. Reselect the same file and resume; confirmed bytes are retained.'));article.append(item);continue}
   const url=new URL(m.contentUrl,location.origin);if(url.origin!==location.origin)throw Error('Invalid private media address.');
   const link=node('a','Open '+(m.variant==='original'?'original':'prepared version'));link.href=url.pathname;link.target='_blank';link.rel='noopener';item.append(link);
   if(m.variant==='shared'){
    const media=node(m.mime.startsWith('image/')?'img':'video');media.src=url.pathname;
    if(media.tagName==='IMG'){media.alt=f.title+' · prepared shared version';media.loading='lazy'}else{media.controls=true;media.playsInline=true;media.preload='metadata'}item.append(media);
   }
   if(m.annotations?.text)item.append(node('p',m.annotations.text));article.append(item);
  }
  if(!f.media.length)article.append(node('p',f.carriedFrom?'Prior observation retained by reference; record a separate finding for a new test.':'Finding saved. Add a photo or video.','muted'));list.append(article);
 }
 await loadHistory();
}
findSelect.addEventListener('change',()=>{if(findSelect.value)localStorage.setItem(findingKey+'Id',findSelect.value);else localStorage.removeItem(findingKey+'Id')});
root.querySelector('[data-create]').addEventListener('click',async event=>{
 const button=event.currentTarget;button.disabled=true;
 try{
  if(!titleInput.value.trim()||!timeInput.value)throw Error('Enter the finding and its technician-reported capture time.');
  const measurements=[];
  for(let i=0;i<3;i++){const name=root.querySelector('[name=measurementName'+i+']').value,value=root.querySelector('[name=measurementValue'+i+']').value,unit=root.querySelector('[name=measurementUnit'+i+']').value;if(name||value||unit){if(!name||value===''||!unit)throw Error('Each measurement needs its name, value and unit.');measurements.push({name,value:Number(value),unit})}}
  const provenance=root.querySelector('[name=provenance]').value==='native'?{kind:'native'}:{kind:'imported',system:root.querySelector('[name=sourceSystem]').value,recordId:root.querySelector('[name=sourceRecordId]').value,observer:root.querySelector('[name=sourceObserver]').value};
  const result=await api('/findings',{observation:{measurements,recommendation:root.querySelector('[name=recommendation]').value,provenance},jobId:root.dataset.jobId,clientId:opaqueKey(findingKey+'Client'),title:titleInput.value.trim(),capturedAt:new Date(timeInput.value).toISOString()});
  localStorage.setItem(findingKey+'Id',result.id);localStorage.removeItem(findingKey+'Client');await loadFindings();findSelect.value=result.id;say('Finding saved. Capture or select its evidence.');
 }catch(error){say(error.message)}finally{button.disabled=false}
});
root.querySelector('[data-pause]').addEventListener('click',()=>{paused=true;say('Pausing after the current chunk is confirmed. Use Resume upload to continue.')});
root.querySelector('[data-save]').addEventListener('click',async()=>{
 if(busy)return;const finding=selectedFinding();if(!finding){say('Create or choose a finding first.');return}if(!selectedFile){say('Capture or select a photo or video first.');return}
 busy=true;paused=false;root.querySelector('[data-save]').disabled=true;root.querySelector('[data-pause]').disabled=false;
 try{
  const original=await upload(selectedFile,'original',finding);
  let shared,annotations=null;
  if(bitmap){
   draw();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.78));if(!blob)throw Error('This browser could not prepare the JPEG. The original is retained.');
   const text=label();annotations={strokes:strokes.filter(s=>s.points.length>=2),...(text?{text,labels:[{text,x:.04,y:.94}]}:{})};
   shared=new File([blob],selectedFile.name.replace(/\.[^.]+$/,'')+'-shared.jpg',{type:'image/jpeg'});
  }else{shared=new File([selectedFile],selectedFile.name.replace(/\.[^.]+$/,'')+'-shared.'+(selectedFile.type==='video/mp4'?'mp4':'webm'),{type:selectedFile.type});if(label())annotations={text:label()}}
  await upload(shared,'shared',finding,original.id,annotations);await loadFindings();
  root.querySelector('[data-save]').textContent='Save to repair order';
  say('Saved original and prepared shared version. '+selectedFile.size.toLocaleString()+' original bytes; '+shared.size.toLocaleString()+' prepared bytes. Both are private; nothing was sent.');
 }catch(error){root.querySelector('[data-save]').textContent='Resume upload';say(error.message+' Confirmed bytes remain available for resume.');await loadFindings().catch(()=>{})}
 finally{busy=false;root.querySelector('[data-save]').disabled=false;root.querySelector('[data-pause]').disabled=true}
});
loadFindings().catch(error=>say(error.message));
`;
