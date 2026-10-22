import {createDeliveryEventIntake,createD1EventStore} from './inspection-report-mail.mjs'
import {runtimeBindings,type Bindings} from '../auth.server'
import {connectorSecret} from './connectors/secrets'

const namespace='inspection-report-v1'
const maximumBytes=1024*1024
const reply=(status:number)=>new Response(null,{status,headers:{'cache-control':'no-store'}})

/** Exact provider bytes are bounded before signature verification; sessions confer no authority here. */
export async function inspectionReportEventResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/mallet\/inspection-report-events\/(sendgrid|resend)$/)
 if(!match)return null
 const env=runtimeBindings(original),provider=match[1]
 if(url.origin!==env.AUTH_ORIGIN||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())||env.MAIL_PROVIDER!==provider)return reply(404)
 if(request.method!=='POST')return reply(405)
 const eventKey=await connectorSecret(env,'mail-events','MAIL_EVENT_KEY')
 if(!eventKey)return reply(503)
 if(Number(request.headers.get('content-length'))>maximumBytes)return reply(413)
 const reader=request.body?.getReader();if(!reader)return reply(400)
 const chunks:Uint8Array[]=[],deliveries=new Map<string,any>();let length=0
 try{
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maximumBytes){await reader.cancel();return reply(413)}chunks.push(value)}
  const rawBody=new Uint8Array(length);let offset=0;for(const chunk of chunks){rawBody.set(chunk,offset);offset+=chunk.length}
  const intake=createDeliveryEventIntake({provider,tenantId:env.AUTH_ORIGIN,eventNamespace:namespace,key:eventKey,store:createD1EventStore({db:env.DB}),authorize:async(event:any)=>{
   // A signature alone cannot authorize another product, mailbox or message.
   if(event.recipients.length!==1)return false
   const result=await env.DB.prepare("SELECT value FROM mallet_records WHERE kind='inspectionReportDelivery' AND json_extract(value,'$.provider')=? AND json_extract(value,'$.providerMessageId')=? AND json_extract(value,'$.to')=?").bind(provider,event.providerMessageId,event.recipients[0]).all<{value:string}>()
   if(result.results.length!==1)return false
   const delivery=JSON.parse(result.results[0].value)
   if(delivery.status!=='accepted'||(event.deliveryId!==null&&event.deliveryId!==delivery.id))return false
   deliveries.set(delivery.id,delivery);return true
  }})
  await intake.ingestWebhook({rawBody,headers:request.headers})
  // Project canonical durable state, including on a duplicate: a crash after intake
  // but before projection is repaired by provider redelivery without sending mail.
  const updates=[]
  for(const delivery of deliveries.values())updates.push(env.DB.prepare(`UPDATE mallet_records SET revision=revision+1,
   value=json_set(value,'$.version',revision+1,'$.downstream',json_object('status',s.status,'at',strftime('%Y-%m-%dT%H:%M:%fZ',s.occurred_at/1000.0,'unixepoch'),'eventId',s.event_id))
   FROM rer_mail_event_states s WHERE kind='inspectionReportDelivery' AND id=?
   AND s.provider=? AND s.tenant_id=? AND s.event_namespace=? AND s.provider_message_id=? AND s.recipient=?
   AND json_extract(value,'$.provider')=s.provider AND json_extract(value,'$.providerMessageId')=s.provider_message_id AND json_extract(value,'$.to')=s.recipient
   AND coalesce(json_extract(value,'$.downstream.eventId'),'')<>s.event_id`).bind(delivery.id,provider,env.AUTH_ORIGIN,namespace,delivery.providerMessageId,delivery.to))
  if(updates.length)await env.DB.batch(updates)
  return reply(204)
 }catch(error){
  const code=(error as {code?:string}).code
  return reply(!code||code==='event_storage_failed'?503:code==='event_signature_invalid'?401:400)
 }finally{reader.releaseLock()}
}
