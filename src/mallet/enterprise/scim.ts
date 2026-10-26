import type {Bindings} from '../../auth.server'
import {HttpError} from '../auth'
import {assertion,audit,connectionFence,type Connection} from './store'
export const USER='urn:ietf:params:scim:schemas:core:2.0:User',LIST='urn:ietf:params:scim:api:messages:2.0:ListResponse',ENTERPRISE='urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
export const resource=(u:any)=>({schemas:[USER,ENTERPRISE],id:u.id,externalId:u.external_id,userName:u.email,displayName:u.display_name,active:!!u.active,roles:[{value:u.role,primary:true}],meta:{resourceType:'User',version:String(u.revision)},[ENTERPRISE]:{department:u.location}})
const text=(value:any,max=255)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f\x7f]/.test(value))throw new HttpError(400,'invalid_scim_value');return value.trim()}
function normalized(body:any,previous?:any){
 const email=text(body.userName??previous?.email).toLowerCase(),external=text(body.externalId??previous?.external_id),name=text(body.displayName??(body.name?.givenName&&body.name?.familyName?body.name.givenName+' '+body.name.familyName:undefined)??previous?.display_name??email)
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof(body.active??(previous?!!previous.active:true))!=='boolean')throw new HttpError(400,'invalid_scim_user')
 const location=body['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User']?.department
 if(body.roles!==undefined&&(!Array.isArray(body.roles)||body.roles.length!==1||body.roles[0]?.value!=='technician')||location!==undefined&&location!=='shop')throw new HttpError(403,'mapping_refused')
 if(previous&&(email!==previous.email||external!==previous.external_id))throw new HttpError(409,'identity_is_immutable')
 return {email,external,name,active:body.active??(previous?!!previous.active:true)}
}
export async function writeUser(env:Bindings,c:Connection,body:any,previous?:any){
 const input=normalized(body,previous),id=previous?.id??crypto.randomUUID(),revision=(previous?.revision??0)+1,authority=connectionFence(c)
 if(!previous&&await env.DB.prepare('SELECT 1 FROM oa_operators WHERE email=? UNION ALL SELECT 1 FROM oa_external_identities WHERE issuer=? AND subject=?').bind(input.email,c.issuer,input.external).first())throw new HttpError(409,'identity_collision')
 const before=previous?{active:!!previous.active,displayName:previous.display_name}:null
 try{await env.DB.batch([assertion(env.DB,authority),
 ...(previous?[env.DB.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM mallet_enterprise_users WHERE id=? AND provider=? AND revision=?) THEN 1 ELSE 0 END').bind(id,c.provider,previous.revision),env.DB.prepare("UPDATE oa_operators SET display_name=?,status=? WHERE id=? AND role='member'").bind(input.name,input.active?'active':'inactive',id),env.DB.prepare('UPDATE mallet_enterprise_users SET display_name=?,active=?,revision=? WHERE id=?').bind(input.name,input.active?1:0,revision,id)]:[
 env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES(?,?,?,'member',?,1,?)").bind(id,input.email,input.name,input.active?'active':'inactive',Date.now()),
 env.DB.prepare("INSERT INTO mallet_enterprise_users(id,provider,external_id,email,display_name,active,revision,role,location) VALUES(?,?,?,?,?,?,1,'technician','shop')").bind(id,c.provider,input.external,input.email,input.name,input.active?1:0)]),
 audit(env.DB,c.owner_id,previous?'enterprise.user.updated':'enterprise.user.provisioned',{provider:c.provider,source:'scim',mappingRevision:c.revision,operatorId:id,before,after:{active:input.active,displayName:input.name,role:'technician',location:'shop'},changes:[{kind:'enterpriseUser',id,beforeRevision:previous?.revision??null,afterRevision:revision}]}),env.DB.prepare('DELETE FROM mallet_assert')])}catch(error){if(String(error).includes('UNIQUE constraint'))throw new HttpError(409,'identity_collision');throw error}
 return resource(await env.DB.prepare('SELECT * FROM mallet_enterprise_users WHERE id=?').bind(id).first())
}
export function patched(body:any,previous:any){
 if(!Array.isArray(body.Operations)||!body.Operations.length||body.Operations.length>10)throw new HttpError(400,'invalid_patch')
 const result:any={userName:previous.email,externalId:previous.external_id,displayName:previous.display_name,active:!!previous.active}
 for(const op of body.Operations){
  if(!['replace','add'].includes(String(op.op).toLowerCase()))throw new HttpError(400,'unsupported_patch')
  if(op.path){if(!['active','displayName','name','roles','userName','externalId','urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'].includes(op.path))throw new HttpError(400,'unsupported_patch');result[op.path]=op.value}
  else {if(!op.value||typeof op.value!=='object'||Array.isArray(op.value)||Object.keys(op.value).some(k=>!['active','displayName','name','roles','userName','externalId','urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'].includes(k)))throw new HttpError(400,'unsupported_patch');Object.assign(result,op.value)}
 }
 return result
}
export async function listUsers(db:D1Database,c:Connection,url:URL){
 const filter=url.searchParams.get('filter'),match=filter?.match(/^userName eq ("(?:[^"\\]|\\.)*")$/)
 if(filter&&!match)throw new HttpError(400,'unsupported_filter')
 let email:string|undefined;try{email=match?JSON.parse(match[1]).toLowerCase():undefined}catch{throw new HttpError(400,'invalid_filter')}
 const start=Number(url.searchParams.get('startIndex')??1),count=Number(url.searchParams.get('count')??100)
 if(!Number.isSafeInteger(start)||start<1||!Number.isSafeInteger(count)||count<0||count>100)throw new HttpError(400,'invalid_pagination')
 const where='provider=?'+(email!==undefined?' AND email=?':''),params=email!==undefined?[c.provider,email]:[c.provider]
 const total=await db.prepare('SELECT COUNT(*) AS n FROM mallet_enterprise_users WHERE '+where).bind(...params).first<number>('n'),items=(await db.prepare('SELECT * FROM mallet_enterprise_users WHERE '+where+' ORDER BY id LIMIT ? OFFSET ?').bind(...params,count,start-1).all()).results
 return {schemas:[LIST],totalResults:total,startIndex:start,itemsPerPage:items.length,Resources:items.map(resource)}
}
