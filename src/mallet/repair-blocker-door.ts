import {runtimeBindings,type Bindings} from '../auth.server'
import {HttpError,type Actor,type Authority} from './auth'
import {execute,load} from './model'
import {routingPeople} from './routing-door'
import {repairBlockerView} from './repair-blockers'

export async function readRepairBlockers(db:D1Database,actor:Actor,authority:Authority,jobId:string){
 if(!['owner','admin'].includes(actor.role)||actor.staff)throw new HttpError(403,'manager_required')
 const checked=await routingPeople(db,authority),state=await load(db)
 const valid=await db.prepare(`SELECT 1 AS ok FROM mallet_meta WHERE id=1 AND version=? AND (${checked.authority.sql})`).bind(state.version,...checked.authority.params).first()
 if(!valid)throw new HttpError(409,'source_changed')
 return {view:{...repairBlockerView(state,jobId,checked.people),observedAt:new Date().toISOString()},people:checked.people.map(p=>({...p,status:'active'}))}
}
export async function repairBlockerCommand(db:D1Database,actor:Actor,authority:Authority,command:string,input:any){
 if(!['owner','admin'].includes(actor.role)||actor.staff)throw new HttpError(403,'manager_required')
 const checked=await routingPeople(db,authority)
 return execute(db,actor,command,{...input,activePeople:checked.people},checked.authority)
}

/** Reconcile observations only; this worker cannot approve, send, perform or complete work. */
export async function runRepairBlockers(original:Bindings,at:number){
 const env=runtimeBindings(original),checked=await routingPeople(env.DB)
 return execute(env.DB,{id:'mallet-blocker-scheduler',name:'Repair blocker scheduler',role:'system'},'blocker.sweep',{activePeople:checked.people},checked.authority,new Date(at).toISOString())
}
