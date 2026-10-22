import {reportLinkView} from './inspection-report-door'
import {runtimeBindings,type Bindings} from '../auth.server'
import {digest,type Actor,type Authority} from './auth'
import {execute,fail,load,rows,text} from './model'
import {linkActive,sharedDiagnoses} from './diagnostics'
import {listFindings,uploadScope} from './media/service'
import {uploadView} from './media/types'
import {customerReport} from './ui/diagnostics'
import {page} from './ui/shell'

/** Attachments are server-resolved snapshots of completed media on the same repair, never caller claims. */
export async function diagnosisInput(db:D1Database,actor:Actor,authority:Authority,raw:any) {
 const ids=Array.isArray(raw.attachmentIds)?raw.attachmentIds:[],input={...raw,attachments:[]},params:any[]=[]
 if(ids.length>10)fail('INPUT','Attach at most 10 media files.',null,400)
 for(const id of new Set(ids.map((x:unknown)=>text(x,'attachment')))) {
  const {row}=await uploadScope(db,actor,authority,id as string)
  if(row.job_id!==raw.jobId||!row.complete)fail('INPUT','Attach only completed media from this repair.',null,400)
  const m=uploadView(row);input.attachments.push({id:m.id,jobId:row.job_id,findingId:m.findingId,variant:m.variant,filename:m.filename,mime:m.mime,sha256:m.sha256,capturedAt:m.capturedAt,by:m.by});params.push(row.id,row.job_id,row.sha256)
 }
 const guard=input.attachments.map(()=>'EXISTS(SELECT 1 FROM mallet_media_uploads WHERE id=? AND job_id=? AND complete=1 AND sha256=?)')
 return {input,authority:guard.length?{sql:`(${authority.sql}) AND ${guard.join(' AND ')}`,params:[...authority.params,...params]}:authority}
}
export async function diagnosisMedia(db:D1Database,actor:Actor,authority:Authority,jobId:string) {
 if(actor.role==='agent')return []
 const {findings}=await listFindings(db,actor,authority,jobId)
 return findings.flatMap((f:any)=>f.media.filter((m:any)=>m.complete).map((m:any)=>({id:m.id,variant:m.variant,label:`${f.title} · ${m.filename} · ${m.variant}`})))
}
/** Owner/admin create a link: 256 random bits shown once; only the SHA-256 is stored, outside archives. */
export async function createLink(db:D1Database,actor:Actor,authority:Authority,input:any,origin:string) {
 const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
 const {tokenHash:_ignored,...rest}=input,row=await execute(db,actor as any,'diagnosisLink.create',rest,authority)
 await db.batch([db.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN ('+authority.sql+') THEN 1 ELSE 0 END').bind(...authority.params),db.prepare('INSERT INTO mallet_customer_links(id,token_hash,job_id,created_at) VALUES(?,?,?,?)').bind(row.id,await digest(token),row.jobId,row.createdAt),db.prepare('DELETE FROM mallet_assert')])
 return {...row,url:`${origin}/inspection/${token}`}
}
const unavailable=async(status=404)=>page('Link not available','<section class="card"><p>This inspection link is not available. Ask your repair shop for a new link.</p></section>',undefined,status,{heading:false})
/** The customer's read-only view: no session, GET only, and the same answer for unknown, expired and revoked links. */
export async function customerLinkResponse(request:Request,original:Bindings):Promise<Response|null> {
 const url=new URL(request.url),match=url.pathname.match(/^\/inspection\/([^/]*)(\/.*)?$/)
 if(!match)return null
 const env=runtimeBindings(original)
 if(url.origin!==env.AUTH_ORIGIN||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()))return new Response('Not found',{status:404})
 if(!['GET','HEAD'].includes(request.method))return unavailable(405)
 if(!/^[A-Za-z0-9_-]{43}$/.test(match[1]))return unavailable()
 const found=await env.DB.prepare('SELECT id FROM mallet_customer_links WHERE token_hash=?').bind(await digest(match[1])).first<{id:string}>()
 if(!found)return unavailable()
 const s=await load(env.DB),now=new Date().toISOString(),link=rows(s,'diagnosisLink').find(l=>l.id===found.id)
 if(!link||!linkActive(link,now))return unavailable()
 const job=rows(s,'job').find(j=>j.id===link.jobId)
 if(!job)return unavailable()
 if(link.reportId)return reportLinkView(request,env,s,link,'/inspection/'+match[1],match[2]??'')
 if(match[2])return unavailable()
 // A view receipt is appended; it never changes an approval.
 if(request.method==='GET'){const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO mallet_records(kind,id,revision,value) VALUES(?,?,?,?)').bind('diagnosisLinkView',id,1,JSON.stringify({id,version:1,linkId:link.id,jobId:link.jobId,at:now})).run()}
 const response=await page('Inspection findings',customerReport(job,rows(s,'asset').find(a=>a.id===job.assetId),sharedDiagnoses(s,job.id),link.expiresAt))
 response.headers.set('referrer-policy','no-referrer');response.headers.set('x-robots-tag','noindex, nofollow')
 return response
}
