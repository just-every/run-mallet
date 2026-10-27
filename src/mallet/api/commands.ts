import {digest,HttpError,type Identity} from '../auth'
import {execute} from '../model'
import {preparationScopes,scopedAuthority} from './clients'

// Canonical object ordering permits equivalent JSON requests; array order remains meaningful.
function canonical(value:any):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}'
 return JSON.stringify(value)
}
export async function preparation(db:D1Database,auth:Identity,request:Request,data:any){
 const command=String(data.command??''),scope=preparationScopes[command]
 if(!scope||!auth.apiClient)throw new HttpError(403,'api_preparation_required')
 const authority=scopedAuthority(auth,scope),key=request.headers.get('idempotency-key')??''
 if(!/^[A-Za-z0-9._:-]{1,128}$/.test(key))throw new HttpError(400,'idempotency_key_required')
 const input=data.input??{},hash=await digest(canonical({command,input}))
 return execute(db,auth.actor,command,input,authority,undefined,undefined,{clientId:auth.apiClient.id,key,hash,response:(row:any)=>({id:row.id,externalId:row.id,version:row.version,jobId:row.jobId,status:row.status,...(row.revisions?.length?{revision:row.revisions.at(-1).n}:{})})})
}
