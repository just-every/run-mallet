// Kept as an exact inline script so the server can authorize its SHA-256 in CSP.
export const uploadCode=String.raw`
const api=async(path,body,method=body===undefined?'GET':'POST')=>{
 const response=await fetch('/api/mallet/media'+path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let value;try{value=await response.json()}catch{throw Error('The upload did not receive a valid response. Confirmed chunks are retained; resume when the connection returns.')}
 if(!response.ok)throw Error(value.message||'The media request was refused. Sign in again or check your repair assignment.');return value;
};
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
const opaqueKey=key=>{let value=localStorage.getItem(key);if(!value){value=crypto.randomUUID();localStorage.setItem(key,value)}return value};
let paused=false,busy=false;
const say=text=>{root.querySelector('[data-progress-text]').textContent=text};
async function upload(file,variant,finding,originalId,annotations){
 const bytes=await file.arrayBuffer(),sha256=await hash(bytes),key='mallet.media.'+finding.id+'.'+variant+'.'+sha256;
 let result=await api('/uploads',{findingId:finding.id,clientId:opaqueKey(key),variant,...(originalId?{originalId}:{}),filename:file.name,mime:file.type,size:file.size,sha256,capturedAt:finding.capturedAt,...(annotations?{annotations}:{})});
 const total=Math.ceil(file.size/result.chunkBytes),received=new Set(result.received);
 const progress=root.querySelector('progress');progress.max=file.size;
 const show=()=>{const count=[...received].reduce((n,index)=>n+Math.min(result.chunkBytes,file.size-index*result.chunkBytes),0);progress.value=count;say((variant==='original'?'Original':'Prepared version')+': '+count.toLocaleString()+' of '+file.size.toLocaleString()+' bytes confirmed')};show();
 for(let index=0;index<total;index++){
  if(paused)throw Error('Upload paused. Confirmed bytes are retained. Resume here, or reselect the same file after reopening this repair.');
  if(received.has(index))continue;
  const chunk=new Uint8Array(bytes.slice(index*result.chunkBytes,Math.min(file.size,(index+1)*result.chunkBytes)));
  let binary='';for(const byte of chunk)binary+=String.fromCharCode(byte);
  result=await api('/uploads/'+result.id+'/chunks/'+index,{sha256:await hash(chunk),base64:btoa(binary)},'PUT');received.add(index);show();
 }
 if(paused)throw Error('Upload paused before verification. Resume to verify the retained bytes.');
 result=await api('/uploads/'+result.id+'/complete',{});localStorage.removeItem(key);return result;
}
`;
