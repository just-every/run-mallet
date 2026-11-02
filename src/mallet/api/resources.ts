import {HttpError,type Identity} from '../auth'
import {scopedAuthority} from './clients'

const resources:Record<string,{kind:string;fields:string[]}>={
 customers:{kind:'customerAccount',fields:['name','kind','contactIds','mergedInto']},
 assets:{kind:'asset',fields:['label','identifier','type','customerAccountId','customerName','customerEmail','visits','createdAt']},
 bookings:{kind:'appointment',fields:['serviceId','name','email','status','startAt','endAt','createdAt']},
 repairs:{kind:'job',fields:['assetId','title','status','bayId','technicianId','startAt','endAt','createdAt']},
 parts:{kind:'stockItem',fields:['sku','name','barcode','unit']},
 orders:{kind:'purchaseOrder',fields:['reference','supplier','binId','expectedAt','status','at']}
}
const historyFields=['kind','jobId','subjectId','at']
const encode=(value:unknown)=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
type Cursor={resource:string;parent:string;version:number;after:string}
function cursor(value:string|null,resource:string,parent:string):Cursor|null {
 if(!value)return null
 try{
  if(value.length>2048||!/^[A-Za-z0-9_-]+$/.test(value))throw Error()
  const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))))
  if(Object.keys(parsed).sort().join(',')!=='after,parent,resource,version'||parsed.resource!==resource||parsed.parent!==parent||!Number.isSafeInteger(parsed.version)||parsed.version<0||typeof parsed.after!=='string'||!parsed.after||parsed.after.length>200)throw Error()
  return parsed
 }catch{throw new HttpError(400,'invalid_api_cursor')}
}
function project(row:any,fields:string[],resource:string){
 const value:any={id:row.id,externalId:row.id,version:row.version}
 for(const field of fields)if(row[field]!==undefined)value[field]=row[field]
 if(resource==='orders')value.lines=(row.lines??[]).map((line:any)=>({id:line.id,itemId:line.itemId,jobId:line.jobId,quantityMilli:line.quantityMilli}))
 return value
}
export async function resourceRead(db:D1Database,auth:Identity,url:URL){
 const match=url.pathname.match(/^\/api\/mallet\/v1\/(customers|assets|bookings|repairs|parts|orders)(?:\/([^/]+))?(\/history)?$/)
 if(!match)throw new HttpError(404,'not_found')
 const [,resource,id,history]=match,definition=resources[resource],parent=history?id??'':''
 if(history&&resource!=='repairs')throw new HttpError(404,'not_found')
 const authority=scopedAuthority(auth,resource+':read')
 const raw=url.searchParams.get('limit')??'50',limit=Number(raw)
 if(!/^[1-9][0-9]*$/.test(raw)||!Number.isSafeInteger(limit)||limit>100)throw new HttpError(400,'invalid_api_limit')
 for(const key of url.searchParams.keys())if(!['limit','cursor'].includes(key)||url.searchParams.getAll(key).length!==1)throw new HttpError(400,'invalid_api_query')
 const previous=cursor(url.searchParams.get('cursor'),resource,parent)
 if(id&&!history&&previous)throw new HttpError(400,'invalid_api_cursor')
 const where=history?"kind='event' AND json_extract(value,'$.jobId')=?":'kind=?'+(id?' AND id=?':'')
 const params:any[]=history?[id]:[definition.kind,...(id?[id]:[])]
 const batch=await db.batch([
  db.prepare('SELECT version,CASE WHEN ('+authority.sql+') THEN 1 ELSE 0 END AS allowed FROM mallet_meta WHERE id=1').bind(...authority.params),
  db.prepare('SELECT value FROM mallet_records WHERE '+where+' AND id>? ORDER BY id LIMIT ?').bind(...params,previous?.after??'',id&&!history?1:limit+1),
  ...(history?[db.prepare("SELECT id FROM mallet_records WHERE kind='job' AND id=?").bind(id)]:[])
 ])
 const gate=batch[0].results[0] as {version:number;allowed:number}
 if(gate.allowed!==1)throw new HttpError(403,'api_authority_changed')
 if(previous&&previous.version!==gate.version)throw new HttpError(409,'api_cursor_changed')
 if(history&&!batch[2].results.length)throw new HttpError(404,'not_found')
 if(!await db.prepare('SELECT 1 AS ok WHERE ('+authority.sql+')').bind(...authority.params).first())throw new HttpError(403,'api_authority_changed')
 const rows=(batch[1].results as {value:string}[]).map(r=>JSON.parse(r.value))
 if(id&&!history){if(!rows.length)throw new HttpError(404,'not_found');return project(rows[0],definition.fields,resource)}
 const page=rows.slice(0,limit),end=page.at(-1)
 return {data:page.map(row=>project(row,history?historyFields:definition.fields,resource)),nextCursor:rows.length>limit&&end?encode({resource,parent,version:gate.version,after:end.id}):null,snapshotVersion:gate.version}
}
