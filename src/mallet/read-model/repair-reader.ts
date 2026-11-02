import {HttpError,type Actor,type Authority} from '../auth'
import type {State,Row} from '../model'

const MAX_ROWS=10_000,MAX_BYTES=8*1024*1024,READ_BYTES=128*1024
type Identity={kind:string;id:string;bytes:number}
/** Request-local reader. Nothing is returned unless current authority and the native version still match. */
export class RepairReader {
 readonly state:State={version:0,records:{}}
 private readonly present=new Set<string>()
 private bytes=0
 private started=false
 constructor(private db:D1Database,private actor:Actor,private authority:Authority,private jobId:string){
  if(!['owner','admin','member','agent'].includes(actor.role)||!authority?.sql||!Array.isArray(authority.params))throw new HttpError(403,'forbidden')
 }
 private crew(alias='j'){
  return this.actor.role==='member'?`(json_extract(${alias}.value,'$.technicianId')=? OR EXISTS(SELECT 1 FROM json_each(${alias}.value,'$.helpers') WHERE value=?))`:'1=1'
 }
 private get crewParams(){return this.actor.role==='member'?[this.actor.id,this.actor.id]:[]}
 async check(){
  const rows=await this.db.batch([
   this.db.prepare(`SELECT version,CASE WHEN (${this.authority.sql}) THEN 1 ELSE 0 END AS allowed FROM mallet_meta WHERE id=1`).bind(...this.authority.params),
   this.db.prepare(`SELECT 1 AS allowed FROM mallet_records j WHERE j.kind='job' AND j.id=? AND ${this.crew()}`).bind(this.jobId,...this.crewParams)
  ])
  const meta=rows[0].results[0] as {version:number;allowed:number}|undefined
  if(meta?.allowed!==1)throw new HttpError(403,'forbidden')
  if(!rows[1].results.length)throw new HttpError(404,'not_found')
  if(this.started&&meta.version!==this.state.version)throw new HttpError(409,'repair_changed')
  this.state.version=meta.version;this.started=true
 }
 /** Member access is independently checked for every referenced repair. Agents receive only their native preparation surface. */
 private recordScope(){
  if(this.actor.role==='agent')return {sql:"r.kind IN ('job','asset','estimate','invoice','approval','export','taxSettings','rateProfile')",params:[]}
  if(this.actor.role!=='member')return {sql:this.actor.role==='owner'?'1=1':"r.kind<>'diagnosticResult'",params:[]}
  return {sql:`r.kind<>'diagnosticResult' AND (r.kind<>'job' OR ${this.crew('r')}) AND (json_extract(r.value,'$.jobId') IS NULL OR EXISTS(SELECT 1 FROM mallet_records j WHERE j.kind='job' AND j.id=json_extract(r.value,'$.jobId') AND ${this.crew()}))`,params:[...this.crewParams,...this.crewParams]}
 }
 async read(where:string,params:unknown[]=[]){
  await this.check()
  const scope=this.recordScope();let afterKind='',afterId=''
  const added:{kind:string;row:Row}[]=[]
  for(;;){
   const batch=(await this.db.prepare(`SELECT r.kind,r.id,length(CAST(r.value AS BLOB)) AS bytes FROM mallet_records r WHERE (${where}) AND (${scope.sql}) AND (r.kind,r.id)>(?,?) ORDER BY r.kind,r.id LIMIT 100`).bind(...params,...scope.params,afterKind,afterId).all<Identity>()).results
   if(!batch.length)break
   const wanted=batch.filter(row=>!this.present.has(row.kind+'\x00'+row.id))
   for(let start=0;start<wanted.length;){
    let end=start,bytes=0
    while(end<wanted.length&&bytes+wanted[end].bytes<=READ_BYTES){bytes+=wanted[end].bytes;end++}
    if(end===start||this.present.size+end-start>MAX_ROWS||this.bytes+bytes>MAX_BYTES)throw new HttpError(413,'repair_graph_too_large')
    const selected=wanted.slice(start,end)
    // Recheck the combined size in the same SELECT that returns bytes: a writer
    // growing a row after preflight cannot overflow the transport before fencing.
    const values=(await this.db.prepare(`WITH chosen AS (SELECT kind,id,value FROM mallet_records WHERE (kind,id) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?))) SELECT kind,id,CASE WHEN (SELECT COALESCE(SUM(length(CAST(value AS BLOB))),0) FROM chosen)<=? THEN value ELSE NULL END AS value FROM chosen ORDER BY kind,id`).bind(JSON.stringify(selected.map(row=>[row.kind,row.id])),READ_BYTES).all<{kind:string;id:string;value:string|null}>()).results
    if(values.length!==selected.length||values.some(row=>row.value===null))throw new HttpError(409,'repair_changed')
    for(const value of values){const row=JSON.parse(value.value!) as Row;(this.state.records[value.kind]??=[]).push(row);this.present.add(value.kind+'\x00'+value.id);added.push({kind:value.kind,row})}
    this.bytes+=bytes;start=end
   }
   afterKind=batch.at(-1)!.kind;afterId=batch.at(-1)!.id
   await this.check()
  }
  return added
 }
 async mediaSourceJobs(jobIds:string[]){
  if(this.actor.role==='agent')return []
  await this.check()
  const rows=(await this.db.prepare(`SELECT DISTINCT json_extract(request_json,'$.carriedFrom.jobId') AS id FROM mallet_media_findings WHERE job_id IN (SELECT value FROM json_each(?)) AND json_extract(request_json,'$.carriedFrom.jobId') IS NOT NULL LIMIT 129`).bind(JSON.stringify(jobIds)).all<{id:string}>()).results
  if(rows.length>128)throw new HttpError(413,'repair_graph_too_large')
  return rows.map(row=>row.id)
 }
 async finish(){await this.check();for(const rows of Object.values(this.state.records))rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);return this.state}
}
