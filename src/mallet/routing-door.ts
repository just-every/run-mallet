import {runtimeBindings,type Bindings} from '../auth.server'
import {execute,MalletError,type Actor} from './model'
import type {Authority} from './auth'

/** Operator ids/names/roles come only from native identity; same-transaction version guards fence revocation. */
async function routingPeople(db:D1Database,authority?:Authority){
 const people=(await db.prepare("SELECT id,display_name AS name,role,version FROM oa_operators WHERE status='active' AND role IN ('owner','admin') ORDER BY id").all()).results as any[]
 const snapshot=JSON.stringify(people)
 const sql=`(SELECT COALESCE(json_group_array(json_object('id',id,'name',display_name,'role',role,'version',version)),'[]') FROM (SELECT id,display_name,role,version FROM oa_operators WHERE status='active' AND role IN ('owner','admin') ORDER BY id))=?`
 return {people,authority:{sql:authority?`(${authority.sql}) AND (${sql})`:sql,params:authority?[...authority.params,snapshot]:[snapshot]}}
}
export async function routingCommand(db:D1Database,actor:Actor,authority:Authority,command:string,input:any){
 if(!['owner','admin'].includes(actor.role))throw new MalletError('FORBIDDEN','Use the owner or admin routing door.',403)
 const checked=await routingPeople(db,authority)
 return execute(db,actor,command,{...input,activePeople:checked.people},checked.authority)
}
export async function runRouting(original:Bindings,at:number){
 const env=runtimeBindings(original),checked=await routingPeople(env.DB)
 return execute(env.DB,{id:'mallet-routing-scheduler',name:'Routing scheduler',role:'system'},'routing.sweep',{activePeople:checked.people},checked.authority,new Date(at).toISOString())
}
