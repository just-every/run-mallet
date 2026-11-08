import {digest,HttpError,type Actor,type Authority,type Identity} from '../auth'

export const readScopes=['customers:read','assets:read','bookings:read','repairs:read','parts:read','orders:read']
export const preparationScopes:Record<string,string>={'estimate.prepare':'estimate:prepare','estimate.revise':'estimate:revise','dispatch.prepare':'dispatch:prepare','invoice.prepare':'invoice:prepare'}
const scopes=new Set([...readScopes,...Object.values(preparationScopes)])
// SQLite evaluates expiry inside the transaction, including a replay or delayed write.
const current="c.revoked_at IS NULL AND c.expires_at>(julianday('now')-2440587.5)*86400000 AND o.status='active' AND o.version=c.creator_version AND o.role='owner'"

export async function clientIdentity(db:D1Database,hash:string):Promise<Identity|null> {
 const row=await db.prepare('SELECT c.id,c.label,c.scopes FROM mallet_api_clients c JOIN oa_operators o ON o.id=c.created_by WHERE c.token_hash=? AND '+current).bind(hash).first<{id:string;label:string;scopes:string}>()
 if(!row)return null
 const sql='EXISTS(SELECT 1 FROM mallet_api_clients c JOIN oa_operators o ON o.id=c.created_by WHERE c.token_hash=? AND '+current+')'
 return {actor:{id:row.id,name:row.label,role:'agent'},authority:{sql,params:[hash]},bearer:true,apiClient:{id:row.id,scopes:JSON.parse(row.scopes)}}
}
export function scopedAuthority(auth:Identity,scope:string):Authority {
 if(!auth.apiClient){if(auth.actor.role!=='owner')throw new HttpError(403,'api_scope_required');return auth.authority}
 if(!auth.apiClient.scopes.includes(scope))throw new HttpError(403,'api_scope_required')
 return {sql:'('+auth.authority.sql+') AND EXISTS(SELECT 1 FROM mallet_api_clients c,json_each(c.scopes) s WHERE c.id=? AND s.value=?)',params:[...auth.authority.params,auth.apiClient.id,scope]}
}
export async function clientCommand(db:D1Database,actor:Actor,authority:Authority,command:string,input:any) {
 if(actor.role!=='owner')throw new HttpError(403,'owner_required')
 const guard=db.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN ('+authority.sql+') THEN 1 ELSE 0 END').bind(...authority.params)
 const now=Date.now()
 if(command==='apiClient.revoke'){
  const id=String(input.id??'')
  await db.batch([guard,db.prepare('UPDATE mallet_api_clients SET revoked_at=? WHERE id=?').bind(now,id),db.prepare('INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'mallet:apiClient.revoked',JSON.stringify({id}),now),db.prepare('DELETE FROM mallet_assert')])
  return {id,revoked:true}
 }
 if(command!=='apiClient.create')throw new HttpError(404,'unknown_command')
 const label=String(input.label??'').trim(),requested=input.scopes
 if(!label||label.length>100||!Array.isArray(requested)||!requested.length||requested.length>scopes.size||requested.some((s:any)=>typeof s!=='string'||!scopes.has(s))||new Set(requested).size!==requested.length)throw new HttpError(400,'invalid_api_client')
 const hours=input.expiresInHours===undefined?24:input.expiresInHours
 if(!Number.isSafeInteger(hours)||hours<1||hours>720)throw new HttpError(400,'invalid_api_expiry')
 const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
 const id=crypto.randomUUID(),expiresAt=now+hours*3600000
 await db.batch([guard,db.prepare('INSERT INTO mallet_api_clients(id,token_hash,label,scopes,created_by,creator_version,expires_at,created_at) SELECT ?,?,?,?,id,version,?,? FROM oa_operators WHERE id=? AND role=?').bind(id,await digest(token),label,JSON.stringify(requested),expiresAt,now,actor.id,'owner'),db.prepare('INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'mallet:apiClient.created',JSON.stringify({id,label,scopes:requested,expiresAt}),now),db.prepare('DELETE FROM mallet_assert')])
 return {id,label,scopes:requested,token,expiresAt}
}
