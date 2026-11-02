import {createPortability,PortabilityError,MAX_LINE_BYTES} from '@runeditrun/rer/modules/portability'
import {boundedJson} from '@runeditrun/rer/modules/portability/http'
import type {Bindings} from '../auth.server'
import {identity,originGuard} from './auth'
import policy from './archive-policy.mjs'

// A service contains policy and a live DB binding, never an identity, session or
// schema snapshot. Native operations still check their own current schema and
// durable transfer fences. Avoid re-enumerating every table for every part.
const services=new WeakMap<object,ReturnType<typeof createPortability>>()
async function service(db:D1Database){
 let pending=services.get(db)
 if(!pending){pending=createPortability({db,policy});services.set(db,pending);pending.catch(()=>{if(services.get(db)===pending)services.delete(db)})}
 return pending
}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}})
const insist=(ok:unknown,code:string,status=400)=>{if(!ok)throw new PortabilityError(code,status)}

/** Mallet's owner HTTP adapter over the actual native portability service. */
export async function workshopPortabilityResponse(request:Request,env:Bindings):Promise<Response>{
 try{
  const api=await service(env.DB),auth=await identity(request,env);originGuard(request,env,auth.bearer)
  insist(auth.actor.role==='owner','unauthorized',401)
  const parts=new URL(request.url).pathname.slice('/api/portability/'.length).split('/'),[collection,id,action,index]=parts
  if(id)insist(await api.actor(id)===auth.actor.id,'job_not_found',404)
  insist(['exports','imports'].includes(collection)&&parts.length<=4,'route_not_found',404)
  const transfer=api[collection as 'exports'|'imports'],body=async():Promise<any>=>boundedJson(request,MAX_LINE_BYTES)
  if(request.method==='POST'&&!id){
   const data=await body();if(collection==='imports'){insist(data.confirmed===true,'confirmation_required');return json({id:await api.imports.create(data.manifest,auth.actor.id)},201)}
   return json({id:await api.exports.create(auth.actor.id)},201)
  }
  if(request.method==='GET'&&id&&!action)return json(await transfer.status(id))
  if(request.method==='POST'&&id&&action==='abort'&&!index)return json(await transfer.abort(id))
  if(collection==='exports'&&request.method==='POST'&&id&&action==='advance'&&!index)return json(await api.exports.advance(id,await body()))
  if(collection==='exports'&&request.method==='GET'&&id&&action==='download'&&!index)return new Response(await api.exports.download(id),{headers:{'content-type':'application/x-ndjson','cache-control':'no-store'}})
  if(collection==='imports'&&request.method==='PUT'&&id&&action==='parts'&&/^(0|[1-9]\d*)$/.test(index??''))return json(await api.imports.uploadPart(id,Number(index),await body()))
  if(collection==='imports'&&request.method==='POST'&&id&&action==='finalize'&&!index)return json(await api.imports.finalize(id,await body()))
  throw new PortabilityError('route_not_found',404)
 }catch(error){return json({error:error instanceof PortabilityError?error.code:'operation_failed'},error instanceof PortabilityError?error.status:500)}
}
