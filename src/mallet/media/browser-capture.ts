export const captureCode=String.raw`
const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),preview=root.querySelector('[data-video-preview]');
let selectedFile=null,bitmap=null,strokes=[],activeStroke=null,previewUrl=null,recorder=null,stream=null,recordTimer=null;
const label=()=>root.querySelector('[name=annotation]').value.trim();
function draw(){if(!bitmap)return;ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);ctx.lineCap='round';ctx.lineJoin='round';
 for(const stroke of strokes){ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.width*canvas.width;ctx.beginPath();stroke.points.forEach((p,i)=>i?ctx.lineTo(p.x*canvas.width,p.y*canvas.height):ctx.moveTo(p.x*canvas.width,p.y*canvas.height));ctx.stroke()}
 if(label()){ctx.font=Math.max(14,canvas.width*.025)+'px sans-serif';ctx.fillStyle='white';ctx.fillRect(canvas.width*.025,canvas.height*.87,canvas.width*.95,canvas.height*.11);ctx.fillStyle='#a50000';ctx.fillText(label(),canvas.width*.04,canvas.height*.94,canvas.width*.9)}
}
async function selectFile(file){
 if(!file)return;if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type))throw Error('Choose a JPEG, PNG, WebP, MP4 or WebM file.');
 if(file.size===0||file.size>(file.type.startsWith('image/')?8:32)*1024*1024)throw Error('Photos must be at most 8 MiB; videos at most 32 MiB.');
 selectedFile=file;strokes=[];bitmap?.close();bitmap=null;if(previewUrl)URL.revokeObjectURL(previewUrl);
 const photo=file.type.startsWith('image/');canvas.hidden=!photo;preview.hidden=photo;root.querySelector('[data-markup]').hidden=!photo;
 if(photo){bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));draw()}
 else{previewUrl=URL.createObjectURL(file);preview.src=previewUrl}
 root.querySelector('[data-file-name]').textContent=file.name+' · '+file.size.toLocaleString()+' bytes';root.querySelector('[data-save]').disabled=false;say('Ready. The original is kept unchanged; prepare a private version below.');
}
const point=event=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))}};
canvas.addEventListener('pointerdown',event=>{if(!bitmap)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);activeStroke={color:'#c62828',width:Math.min(.1,Math.max(.002,3/canvas.width)),points:[point(event)]};strokes.push(activeStroke);draw()});
canvas.addEventListener('pointermove',event=>{if(!activeStroke||activeStroke.points.length>=1000)return;event.preventDefault();activeStroke.points.push(point(event));draw()});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{activeStroke=null});
root.querySelector('[data-clear]').addEventListener('click',()=>{strokes=[];root.querySelector('[name=annotation]').value='';draw()});root.querySelector('[name=annotation]').addEventListener('input',draw);
for(const input of root.querySelectorAll('input[type=file]'))input.addEventListener('change',()=>selectFile(input.files[0]).catch(error=>say(error.message)));
root.querySelector('[data-record]').addEventListener('click',async()=>{
 if(recorder&&recorder.state==='recording'){recorder.stop();return}
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Recording is unavailable in this browser. The camera/file control accepts a recorded MP4 or WebM.');
  const mime=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('This browser has no supported recording codec.');
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280}},audio:true});
  const parts=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1500000,audioBitsPerSecond:64000});recorder.ondataavailable=event=>{if(event.data.size)parts.push(event.data)};
  recorder.onstop=async()=>{clearTimeout(recordTimer);stream.getTracks().forEach(track=>track.stop());root.querySelector('[data-record]').textContent='Record short video';const type=mime.startsWith('video/mp4')?'video/mp4':'video/webm';await selectFile(new File(parts,['brake-inspection',type==='video/mp4'?'mp4':'webm'].join('.'),{type})).catch(error=>say(error.message))};
  recorder.start(1000);recordTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},30000);root.querySelector('[data-record]').textContent='Stop recording';say('Recording compressed video (up to 30 seconds). Press Stop when finished.');
 }catch(error){stream?.getTracks().forEach(track=>track.stop());say(error.message)}
});
window.addEventListener('pagehide',()=>{clearTimeout(recordTimer);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());bitmap?.close();if(previewUrl)URL.revokeObjectURL(previewUrl)});
`;
