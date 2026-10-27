import {HttpError,type Actor,type Authority} from './auth'
import type {State} from './model'
import {e,field,box,when} from './ui/common'

export type AuditChange={kind:string;id:string;beforeRevision:number|null;afterRevision:number}
export type AuditEntry={id:string;version:number;action:string;at:string;actor:{id:string;name:string;role:string};policy:string;changes:AuditChange[];evidence:string[]}
// Only revision references enter this ledger. Command payloads, credentials, raw provider bodies and free text do not.
export function retainAudit(s:State, before:Map<string,string>, actor:AuditEntry['actor'],action:string,at:string) {
 const changes:any[]=[],evidence:string[]=[]
 for(const [kind,values] of Object.entries(s.records))for(const row of values){
  if(kind==='audit')continue
  const old=before.get(kind+':'+row.id)
  if(old===JSON.stringify(row))continue
  changes.push({kind,id:row.id,beforeRevision:old?JSON.parse(old).version:null,afterRevision:row.version})
  if(['event','approval','creditNote','stockCount','proposal','estimate','invoice','timeCorrection'].includes(kind))evidence.push(kind+':'+row.id)
 }
 if(!changes.length)return
 const id=crypto.randomUUID();(s.records.audit??=[]).push({id,version:1,action,at,actor:{...actor},policy:'native-command-v1',changes,evidence})
}
export async function auditReport(db:D1Database,actor:Actor,authority:Authority,params:URLSearchParams) {
 if(actor.role!=='owner')throw new HttpError(403,'owner_required')
 const q=(params.get('q')??'').trim(),who=params.get('actor')??'',action=params.get('action')??'',from=params.get('from')??'',to=params.get('to')??'',offset=Number(params.get('offset')??0)
 if(q.length>200||who.length>200||action.length>100||!Number.isSafeInteger(offset)||offset<0||offset>10000000)throw new HttpError(400,'invalid_audit_filter')
 for(const value of [from,to])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw new HttpError(400,'invalid_audit_date')
 if(from&&to&&from>to)throw new HttpError(400,'invalid_audit_date')
 const clauses=["kind='audit'",`(${authority.sql})`],values:any[]=[...authority.params]
 if(q){clauses.push("instr(lower(value),lower(?))>0");values.push(q)}
 if(who){clauses.push("json_extract(value,'$.actor.id')=?");values.push(who)}
 if(action){clauses.push("json_extract(value,'$.action')=?");values.push(action)}
 if(from){clauses.push("json_extract(value,'$.at')>=?");values.push(from)}
 if(to){clauses.push("json_extract(value,'$.at')<?");values.push(new Date(Date.parse(to)+86400000).toISOString().slice(0,10))}
 const rows=await db.prepare(`SELECT value FROM mallet_records WHERE ${clauses.join(' AND ')} ORDER BY json_extract(value,'$.at') DESC,id DESC LIMIT 101 OFFSET ?`).bind(...values,offset).all<{value:string}>()
 // Recheck after the projection too: revocation during a read reveals no new evidence.
 if(!await db.prepare(`SELECT 1 AS ok WHERE (${authority.sql})`).bind(...authority.params).first())throw new HttpError(403,'owner_required')
 const retention=await db.prepare("SELECT json_extract(value,'$.auditMinimumDays') AS days FROM mallet_records WHERE kind='retentionPolicy' LIMIT 1").first<{days:number|null}>()
 return {auditMinimumDays:retention?.days??null,entries:rows.results.slice(0,100).map(x=>JSON.parse(x.value) as AuditEntry),nextOffset:rows.results.length>100?offset+100:null,filters:{q,actor:who,action,from,to},policy:'native-command-v1'}
}
export function auditPage(report:Awaited<ReturnType<typeof auditReport>>,params:URLSearchParams) {
 const filters=report.filters,query=new URLSearchParams(params);query.delete('format');query.delete('offset')
 const downloads=['json','csv'].map(format=>{const p=new URLSearchParams(params);p.set('format',format);return `<a href="/api/mallet/audit?${e(p.toString())}">Download ${format.toUpperCase()} page</a>`}).join(' · ')
 return box('Find accountable changes',`<p>Audit minimum retention label: ${report.auditMinimumDays===null?'unspecified':e(report.auditMinimumDays)+' days'}. All audit evidence is preserved; no timer or deletion. <a href="/app/retention">Retention settings</a>.</p><p>Private owner audit. Corrections append; revision references link retained decisions without copying secrets. Dates include the whole UTC day. Downloads contain the current page of up to 100 entries.</p><form method="get" action="/app/audit">${field('Search audit','q','search',filters.q)}${field('Actor ID','actor','text',filters.actor)}${field('Exact action','action','text',filters.action)}${field('From UTC date','from','date',filters.from)}${field('Through UTC date','to','date',filters.to)}<button>Search audit</button></form><p>${downloads}</p>`)+box('Audit history',report.entries.length?`<ul class="list">${report.entries.map(row=>`<li class="plain"><strong>${e(row.action)}</strong><p>${e(row.actor.name)} · ${e(row.actor.role)} · ${when(row.at)}</p><p>Actor ${e(row.actor.id)} · Policy ${e(row.policy)}</p><details><summary>Revisions and evidence</summary><ul>${row.changes.map((c:any)=>`<li>${e(c.kind)} ${e(c.id)}: ${e(c.beforeRevision??'new')} → ${e(c.afterRevision)}</li>`).join('')}</ul><p>${row.evidence.map(x=>e(typeof x==='string'?x:JSON.stringify(x))).join(' · ')||'No separate decision record'}</p></details></li>`).join('')}</ul>${report.nextOffset!==null?`<p><a href="/app/audit?${e(query.toString())}&amp;offset=${report.nextOffset}">Next audit page</a></p>`:''}`:'<p>No audit entries match these filters.</p>')
}
const cell=(value:unknown)=>{let s=typeof value==='string'?value:JSON.stringify(value);if(/^[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
export function auditCsv(entries:AuditEntry[]){return [['id','action','at','actor','policy','changes','evidence'].join(','),...entries.map(x=>[x.id,x.action,x.at,x.actor,x.policy,x.changes,x.evidence].map(cell).join(','))].join('\r\n')+'\r\n'}
