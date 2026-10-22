import {e} from './ui/common'
import {runtimeBindings,type Bindings} from '../auth.server'
import {type Actor,type Authority} from './auth'
import {execute,fail,load,rows} from './model'
import {uploadScope} from './media/storage'
import type {ChunkRow,UploadRow} from './media/types'
import {streamMedia} from './media/http'
import {byteURL,authorizedBytes} from './media/scoped-bytes'
import {createLink} from './diagnosis-links'
import {operatorMail} from '../mail.server.mjs'
import {page} from './ui/shell'
import {customerInspectionReport,proposalPage} from './ui/inspection-reports'
export async function inspectionReportInput(db:D1Database,actor:Actor,authority:Authority,raw:any){
 if(!['owner','admin'].includes(actor.role))fail('FORBIDDEN','Owner/admin review required.',null,403)
 if(!Array.isArray(raw.entries)||raw.entries.length>30)fail('INPUT','Review at most 30 findings.',null,400)
 const guards:string[]=[],params:any[]=[],entries=[]
 for(const entry of raw.entries){
  if(!Array.isArray(entry.mediaIds)||entry.mediaIds.length>10)fail('INPUT','Choose at most 10 prepared media files per finding.',null,400)
  const media=[]
  for(const id of new Set(entry.mediaIds)){
   const {row}=await uploadScope(db,actor,authority,String(id))
   if(row.job_id!==raw.jobId||row.variant!=='shared'||!row.complete)fail('REPORT_MEDIA','Review only completed shared variants on this repair; originals stay private.',null,400)
   media.push({id:row.id,mime:row.mime,sha256:row.sha256,size:row.size,capturedAt:row.captured_at})
   guards.push("EXISTS(SELECT 1 FROM mallet_media_uploads WHERE id=? AND job_id=? AND variant='shared' AND complete=1 AND sha256=?)");params.push(row.id,raw.jobId,row.sha256)
  }
  entries.push({...entry,media})
 }
 return {input:{...raw,entries},authority:{sql:`(${authority.sql})${guards.length?' AND '+guards.join(' AND '):''}`,params:[...authority.params,...params]}}
}
export async function sendInspectionReport(env:Bindings,actor:Actor,authority:Authority,input:any){
 const mail=operatorMail(env);if(!mail)fail('REPORT_MAIL','Configure the shop mail sender before sending this report.')
 const claim=await execute(env.DB,actor as any,'inspectionReport.claim',input,authority)
 const link=await createLink(env.DB,actor,authority,{jobId:claim.jobId,days:input.days??7,reportId:claim.reportId},env.AUTH_ORIGIN)
 const report=rows(await load(env.DB),'inspectionReport').find(r=>r.id===claim.reportId)!
 const text=`Mallet · ${report.title}\n${report.vehicle} · ${report.repair}\nYour advisor reviewed this private inspection report.\n${link.url}\nLink expires ${link.expiresAt}. Anyone holding it can read this report and prepared evidence; keep it private. Viewing does not approve or decline work. Contact the shop with questions.`
 let outcome:any
 try{outcome=await mail.send({deliveryId:claim.id,from:String(env.MAIL_FROM??''),to:[claim.to],subject:'Your reviewed inspection report',text,html:'<p>'+e(text).replaceAll('\n','<br>')+'</p><p><a href="'+e(link.url)+'">Open your reviewed inspection report</a></p>',headers:{}})}catch{outcome={status:'uncertain',provider:'mail'}}
 const delivery=await execute(env.DB,actor as any,'inspectionReport.outcome',{deliveryId:claim.id,version:claim.version,linkId:link.id,status:outcome.status==='rejected'?'failed':outcome.status,provider:outcome.provider??'mail',providerMessageId:outcome.providerMessageId??null},authority)
 return {...delivery,url:link.url}
}
export async function reportLinkView(request:Request,env:Bindings,s:any,link:any,base:string,suffix:string):Promise<Response>{
 const report=rows(s,'inspectionReport').find(r=>r.id===link.reportId&&r.jobId===link.jobId)
 if(!report)return new Response('Not available',{status:404})
 const mediaMatch=suffix.match(/^\/media\/([^/]+)$/)
 if(mediaMatch){
  const selected=report.entries.flatMap((entry:any)=>entry.media).find((m:any)=>m.id===mediaMatch[1]);if(!selected)return new Response('Not available',{status:404})
  const url=new URL(request.url)
  if(!url.search)return new Response(null,{status:303,headers:{location:await byteURL(env,base,link,selected),'cache-control':'private, no-store','referrer-policy':'no-referrer'}})
  if(!await authorizedBytes(env,url,link,selected))return new Response('Not available',{status:404,headers:{'cache-control':'no-store'}})
  const guard="EXISTS(SELECT 1 FROM mallet_records WHERE kind='diagnosisLink' AND id=? AND json_extract(value,'$.revokedAt') IS NULL AND json_extract(value,'$.expiresAt')>?) AND EXISTS(SELECT 1 FROM mallet_media_uploads WHERE id=? AND job_id=? AND variant='shared' AND complete=1 AND sha256=?)"
  const checked=async(sql:string,params:any[])=>{if(!await authorizedBytes(env,url,link,selected))throw Error('expired');const result=await env.DB.batch([env.DB.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN ('+guard+') THEN 1 ELSE 0 END').bind(link.id,new Date().toISOString(),selected.id,link.jobId,selected.sha256),env.DB.prepare(sql).bind(...params),env.DB.prepare('DELETE FROM mallet_assert')]);return result[1].results}
  try{const uploads=await checked('SELECT * FROM mallet_media_uploads WHERE id=?',[selected.id]),row=uploads[0] as unknown as UploadRow
   return await streamMedia(request,row,async(first,last)=>(await checked('SELECT ordinal,sha256,byte_length,base64 FROM mallet_media_chunks WHERE upload_id=? AND ordinal>=? AND ordinal<=? ORDER BY ordinal LIMIT 12',[selected.id,first,last])) as unknown as ChunkRow[])
  }catch{return new Response('Not available',{status:404,headers:{'cache-control':'no-store'}})}
 }
 const proposal=suffix.match(/^\/proposal\/([^/]+)$/)
 if(suffix&&!proposal)return new Response('Not available',{status:404})
 const entry=proposal&&report.entries.find((x:any)=>x.id===proposal[1]);if(proposal&&!entry)return new Response('Not available',{status:404})
 if(!suffix&&request.method==='GET'){
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO mallet_records(kind,id,revision,value) VALUES(?,?,?,?)').bind('diagnosisLinkView',id,1,JSON.stringify({id,version:1,linkId:link.id,reportId:report.id,jobId:link.jobId,at:new Date().toISOString()})).run()
 }
 const response=await page(proposal?'Proposed repair':report.title,proposal?proposalPage(s,entry,base):customerInspectionReport(report,link,base))
 response.headers.set('content-security-policy',(response.headers.get('content-security-policy')??'')+"; media-src 'self'")
 response.headers.set('cache-control','private, no-store');response.headers.set('referrer-policy','no-referrer');response.headers.set('x-robots-tag','noindex, nofollow');return response
}
