export const historyCode = String.raw`
function observationText(article,f){
 const observed=f.carriedFrom||f.observation;
 if(!observed)return;
 if(f.carriedFrom)article.append(node('p','Carried recommendation — not a new test. Original observation '+formatTime(f.carriedFrom.capturedAt)+' by '+f.carriedFrom.by.name,'meta'));
 for(const m of observed.measurements)article.append(node('p',m.name+': '+m.value+' '+m.unit));
 if(observed.recommendation)article.append(node('p','Unresolved recommendation: '+observed.recommendation));
 const source=observed.provenance;
 article.append(node('p',source.kind==='imported'?'Imported evidence · '+source.system+' · record '+source.recordId+' · observer '+source.observer+' (source declared, not provider-verified)':'Native shop observation','meta'));
}
function checklistHistory(article,visit){
 for(const checklist of visit.inspections){
  const entry=node('div',undefined,'media-version');entry.dataset.historyChecklist=checklist.id;
  entry.append(node('h4',checklist.template.snapshot.name+' · template revision '+checklist.template.revision));
  const original=node('a','Open original assigned checklist');original.href='/app/jobs/'+encodeURIComponent(visit.job.id)+'#inspections';entry.append(original);
  for(const item of checklist.template.snapshot.items){
   const result=checklist.results.filter(r=>r.itemId===item.id).at(-1);
   entry.append(node('h5',item.label));
   if(!result){entry.append(node('p','Not inspected — no result recorded.'));continue}
   const measured=result.measurement?result.measurement.name+': '+result.measurement.value+' '+result.measurement.unit+' · ':'';
   entry.append(node('p',measured+result.outcome+' · '+result.reason),node('p','Recorded '+formatTime(result.at)+' by '+result.by.name,'meta'));
   if(result.photo){const photo=node('a','Open checklist photo · captured '+formatTime(result.photo.capturedAt)+' by '+result.photo.by.name);photo.href='/app/jobs/'+encodeURIComponent(visit.job.id)+'/media/view/'+encodeURIComponent(result.photo.id);entry.append(photo)}
  }
  if(checklist.results.some(r=>r.supersedes)){
   const detail=node('details'),summary=node('summary','Retained checklist observations');detail.append(summary);
   for(const result of checklist.results)detail.append(node('p',result.item.label+' · '+result.outcome+(result.measurement?' · '+result.measurement.name+': '+result.measurement.value+' '+result.measurement.unit:'')+' · '+result.reason+' · '+formatTime(result.at)+' · '+result.by.name));entry.append(detail);
  }
  article.append(entry);
 }
}
async function loadHistory(){
 const history=await api('/history?jobId='+encodeURIComponent(root.dataset.jobId)),container=root.querySelector('[data-inspection-history]');container.replaceChildren();
 container.append(node('p','Compare matching measurement names and units; no unit conversion or new test is inferred. Only prior visits you can currently access are included.'));
 for(const visit of history.visits){
  const article=node('article',undefined,'evidence-item');article.append(node('h3',visit.job.title+(visit.job.id===history.jobId?' · current visit':' · prior visit')));
  const link=node('a','Open original visit evidence');link.href='/app/jobs/'+encodeURIComponent(visit.job.id)+'/media';article.append(link);
  checklistHistory(article,visit);
  for(const f of visit.findings){
   const entry=node('div',undefined,'media-version');entry.dataset.historyFinding=f.id;entry.append(node('h4',f.title));entry.append(node('p','Observed '+formatTime(f.capturedAt)+' · recorded by '+f.by.name,'meta'));observationText(entry,f);
   // A carry points back to prior images; it does not re-upload or re-date them.
   for(const m of f.media.filter(m=>m.complete)){
    const a=node('a',m.variant==='original'?'Open historical original photo/video':'Open historical prepared photo/video');a.href='/app/jobs/'+encodeURIComponent(visit.job.id)+'/media/view/'+encodeURIComponent(m.id);entry.append(a,node('br'));
    if(visit.job.id!==history.jobId&&m.variant==='shared'&&m.mime.startsWith('image/')){const img=node('img');img.src=m.contentUrl;img.alt=f.title+' · observed '+f.capturedAt;img.loading='lazy';entry.append(img)}
   }
   if(f.carriedFrom){const a=node('a','Original observation and images');a.href='/app/jobs/'+encodeURIComponent(f.carriedFrom.jobId)+'/media';entry.append(a)}
   if(f.resolution){const by=JSON.parse(f.resolution.actor_json);entry.append(node('p','Resolved '+formatTime(f.resolution.resolved_at)+' by '+by.name+': '+f.resolution.reason));}
   else if(f.observation?.recommendation){
    if(visit.job.id!==history.jobId){
     const label=node('label','Prior declined decision (optional)'),select=document.createElement('select');select.setAttribute('aria-label','Declined decision for '+f.title);select.add(new Option('Unresolved recommendation (no recorded decline)',''));
     for(const d of visit.declined)select.add(new Option(d.line.description+' · '+d.disposition+' · '+formatTime(d.at),d.id));label.append(select);entry.append(label);
     const button=node('button','Carry recommendation to this inspection');button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{await api('/carry',{jobId:history.jobId,findingId:f.id,declinedWorkId:select.value||null});await loadFindings();say('Recommendation carried. The original date, observer, measurements and decision are retained; this is not a new test.')}catch(error){say(error.message)}finally{button.disabled=false}});entry.append(button);
    }
    const label=node('label','Resolution reason'),input=document.createElement('input');input.setAttribute('aria-label','Resolution reason for '+f.title);input.maxLength=2000;label.append(input);entry.append(label);
    const resolve=node('button','Resolve recommendation');resolve.type='button';resolve.addEventListener('click',async()=>{resolve.disabled=true;try{await api('/findings/'+encodeURIComponent(f.id)+'/resolve',{reason:input.value});await loadHistory();say('Resolution saved separately; original evidence retained.')}catch(error){say(error.message)}finally{resolve.disabled=false}});entry.append(resolve);
   }
   article.append(entry);
  }
  if(!visit.findings.length&&!visit.inspections.length)article.append(node('p','No observations recorded on this visit.','muted'));container.append(article);
 }
}
`;
