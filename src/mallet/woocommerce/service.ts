import {audit} from '../strong-auth/store'
import type {Bindings} from '../../auth.server'
import {HttpError,type Actor,type Authority} from '../auth'
import {execute,load,rows,integer,text} from '../model'
import {stockBalance} from '../inventory'
import {connectorSecret} from '../connectors/secrets'
export async function current(env:Bindings){
 const connection=await env.DB.prepare("SELECT connection_id AS id,generation,origin,owner_id AS owner FROM mallet_woo_authority WHERE singleton=1 AND enabled=1 AND EXISTS(SELECT 1 FROM oa_operators WHERE id=owner_id AND role='owner' AND status='active')").first<{id:string;generation:string;origin:string;owner:string}>()
 if(!connection)throw new HttpError(409,'woo_disabled','The current owner must explicitly enable WooCommerce.')
 const auth=await connectorSecret(env,'woocommerce','WOO_API_AUTH'),signing=await connectorSecret(env,'woocommerce','WOO_WEBHOOK_SECRET')
 if(!auth||!signing)throw new HttpError(503,'woo_credentials_unavailable','Save both WooCommerce credentials before connecting.')
 const versions=(await env.DB.prepare("SELECT name,version FROM mallet_connector_secrets WHERE connector='woocommerce' ORDER BY name").all<{name:string;version:number}>()).results
 return {...connection,auth,signing,versions}
}
export const connectionGuard=(connection:{id:string;owner:string;generation:string;versions?:{name:string;version:number}[]},authority:Authority={sql:'1',params:[]}):Authority=>({sql:`(${authority.sql}) AND EXISTS(SELECT 1 FROM mallet_woo_authority WHERE singleton=1 AND enabled=1 AND connection_id=? AND owner_id=? AND generation=?) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active') AND NOT EXISTS(SELECT 1 FROM mallet_connector_secrets WHERE connector='woocommerce' AND status<>'active') ${connection.versions?.map(()=>"AND EXISTS(SELECT 1 FROM mallet_connector_secrets WHERE connector='woocommerce' AND name=? AND version=? AND status='active')").join(' ')??''}`,params:[...authority.params,connection.id,connection.owner,connection.generation,connection.owner,...(connection.versions??[]).flatMap(v=>[v.name,v.version])]})
export async function wooGet(env:Bindings,c:Awaited<ReturnType<typeof current>>,path:string){
 const response=await fetch(c.origin+'/wp-json/wc/v3/'+path,{headers:{authorization:'Basic '+c.auth,accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(15000)})
 if(!response.ok)throw new HttpError(502,'woo_provider_refused','WooCommerce refused the authenticated read.')
 const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let size=0
 if(!reader)throw new HttpError(502,'woo_provider_invalid')
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024)throw new HttpError(502,'woo_provider_size');chunks.push(value)}}finally{await reader.cancel()}
 const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length}const data=new TextDecoder().decode(raw)
 try{return JSON.parse(data)}catch{throw new HttpError(502,'woo_provider_invalid')}
}
const cents=(value:any)=>{if(typeof value!=='string'||!/^\d{1,7}\.\d{2}$/.test(value))throw new HttpError(409,'woo_money');return integer(Math.round(Number(value)*100),'USD cents')}
export async function observe(env:Bindings,c:Awaited<ReturnType<typeof current>>,id:number,authority?:Authority,restockRefundIds:number[]=[]){
 const raw=await wooGet(env,c,'orders/'+id),refunds=await wooGet(env,c,'orders/'+id+'/refunds?per_page=100')
 if(raw.id!==id||raw.currency!=='USD'||!Array.isArray(raw.line_items)||!raw.line_items.length||raw.line_items.length>100||!Array.isArray(refunds)||refunds.length>=100)throw new HttpError(409,'woo_order_unsupported')
 const lines=raw.line_items.map((l:any)=>({id:integer(l.id,'line',1),productId:integer(l.product_id,'product',1),quantity:integer(l.quantity,'quantity',1,100000),totalCents:cents(l.total)})).sort((a:any,b:any)=>a.id-b.id)
 if(new Set(lines.map((l:any)=>l.id)).size!==lines.length)throw new HttpError(409,'woo_order_unsupported')
 const receipts=refunds.map((r:any)=>({providerId:integer(r.id,'refund',1),amountCents:cents(r.amount),lines:r.line_items.map((l:any)=>{const source=l.meta_data?.find((m:any)=>m.key==='_refunded_item_id')?.value,original=lines.find((o:any)=>o.id===Number(source));if(!original)throw new HttpError(409,'woo_refund_line');return {lineId:original.id,quantity:integer(-l.quantity,'refunded quantity',1,100000),totalCents:cents(String(l.total).replace(/^-/,'').includes('.')?String(l.total).replace(/^-/,''):Number(-l.total).toFixed(2))}}).sort((a:any,b:any)=>a.lineId-b.lineId)})).sort((a:any,b:any)=>a.providerId-b.providerId)
 const order={providerId:id,status:text(raw.status,'provider status',50),transactionId:text(raw.transaction_id??'','payment identifier',200,true),paymentMethod:text(raw.payment_method??'','payment method',100,true),paidAt:raw.date_paid_gmt?String(raw.date_paid_gmt)+'Z':null,totalCents:cents(raw.total),currency:'USD',lines}
 // A verified read grants stock observation only, never processor or counter tender authority.
 return execute(env.DB,{id:c.id,name:'WooCommerce observation',role:'system'},'woo.observe',{connectionId:c.id,order,refunds:receipts,restockRefundIds},connectionGuard(c,authority))
}
export async function wooCommand(env:Bindings,actor:Actor,authority:Authority,command:string,p:any){
 if(actor.role!=='owner')throw new HttpError(403,'owner_required')
 if(command==='woocommerce.disable'){await env.DB.batch([env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE 0 END`).bind(...authority.params),env.DB.prepare('UPDATE mallet_woo_authority SET enabled=0 WHERE singleton=1'),audit(env.DB,actor.id,'woocommerce.disabled',{}),env.DB.prepare('DELETE FROM mallet_assert')]);return {enabled:false}}
 if(command==='woocommerce.enable'){
  if(p.authority!=='mallet'||Number(p.acknowledge)!==1)throw new HttpError(409,'woo_acknowledgment','Acknowledge Mallet stock authority and the declaration.')
  const origin=new URL(String(p.origin));if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||!(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))throw new HttpError(400,'woo_origin')
  if(!await connectorSecret(env,'woocommerce','WOO_API_AUTH')||!await connectorSecret(env,'woocommerce','WOO_WEBHOOK_SECRET'))throw new HttpError(503,'woo_credentials_unavailable')
  const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(origin.origin))),v=>v.toString(16).padStart(2,'0')).join(''),generation=crypto.randomUUID()
  await env.DB.batch([env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE 0 END`).bind(...authority.params),env.DB.prepare('INSERT INTO mallet_woo_authority VALUES(1,?,?,?,?,1) ON CONFLICT(singleton) DO UPDATE SET connection_id=excluded.connection_id,generation=excluded.generation,origin=excluded.origin,owner_id=excluded.owner_id,enabled=1').bind(id,generation,origin.origin,actor.id),audit(env.DB,actor.id,'woocommerce.enabled',{connectionId:id,authority:'mallet',declarationVersion:1}),env.DB.prepare('DELETE FROM mallet_assert')]);return {id,enabled:true,authority:'mallet'}
 }
 const c=await current(env)
 if(command==='woocommerce.map'){
  const productId=integer(Number(p.productId),'product',1),product=await wooGet(env,c,'products/'+productId)
  if(product.id!==productId||product.type!=='simple'||product.variations?.length)throw new HttpError(409,'woo_product_unsupported')
  return execute(env.DB,actor as any,'woo.mapVerified',{connectionId:c.id,productId,sku:product.sku,itemId:p.itemId,binId:p.binId},connectionGuard(c,authority))
 }
 if(command==='woocommerce.reconcile')return observe(env,c,integer(Number(p.orderId),'order',1),authority,String(p.restockRefundIds??'').split(',').filter(Boolean).map(id=>integer(Number(id),'refund identity',1)))
 throw new HttpError(404,'unknown_command')
}
export async function wooView(env:Bindings){
 const s=await load(env.DB),connection=await env.DB.prepare('SELECT connection_id AS id,origin,enabled FROM mallet_woo_authority WHERE singleton=1').first()
 return {connection,authority:'mallet',mappings:rows(s,'wooMapping'),orders:rows(s,'wooOrder'),refunds:rows(s,'wooRefund'),items:rows(s,'stockItem'),bins:rows(s,'stockBin'),balances:rows(s,'wooMapping').map(m=>({...stockBalance(s,m.itemId,m.binId),productId:m.productId}))}
}
