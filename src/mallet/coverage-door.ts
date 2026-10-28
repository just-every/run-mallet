import {runtimeBindings,type Bindings} from '../auth.server'
import type {Actor,Authority} from './auth'
import {execute,fail,rows,type State} from './model'
const scheduler={id:'mallet-coverage-review',name:'Coverage review scheduler',role:'system' as const}
export async function coverageCommand(env:Bindings,actor:Actor,authority:Authority,command:string,input:any){
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages coverage reviews.',null,403)
 const grant={sql:'('+authority.sql+') AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role=\'owner\' AND status=\'active\')',params:[...authority.params,actor.id]}
 const prior=command==='coverage.schedule'?await env.DB.prepare("SELECT id FROM mallet_records WHERE kind='coverageReview' AND json_extract(value,'$.reference')=?").bind(input.reference).first():null
 const row=await execute(env.DB,actor as any,command,input,grant)
 if(command==='coverage.schedule'||command==='coverage.activate'){
  // A repeated schedule never reactivates archived authority.
  const activate=command==='coverage.activate'?'ON CONFLICT(review_id) DO UPDATE SET owner_id=excluded.owner_id,owner_version=excluded.owner_version':'ON CONFLICT(review_id) DO NOTHING'
  if(command==='coverage.activate'||!prior)await env.DB.prepare('INSERT INTO mallet_coverage_authority SELECT ?,id,version FROM oa_operators WHERE id=? AND ('+grant.sql+') '+activate).bind(row.id,actor.id,...grant.params).run()
 }
 return row
}
export async function coverageLocalIds(env:Bindings){
 return (await env.DB.prepare("SELECT a.review_id FROM mallet_coverage_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE o.version=a.owner_version AND o.role='owner' AND o.status='active'").all<{review_id:string}>()).results.map(r=>r.review_id)
}
export async function coverageState(env:Bindings,s:State){
 const ids=new Set(await coverageLocalIds(env))
 return {...s,records:{...s.records,coverageReview:rows(s,'coverageReview').map(r=>({...r,localAuthority:ids.has(r.id)}))}}
}
export async function runCoverageReviews(original:Bindings,at:number){
 const env=runtimeBindings(original),ids=await coverageLocalIds(env)
 const guard={sql:"(SELECT count(*) FROM mallet_coverage_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE a.review_id IN (SELECT value FROM json_each(?)) AND o.version=a.owner_version AND o.role='owner' AND o.status='active')=json_array_length(?)",params:[JSON.stringify(ids),JSON.stringify(ids)]}
 await execute(env.DB,scheduler,'coverage.sweep',{localIds:ids},guard,new Date(at).toISOString())
}
