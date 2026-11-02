import {MalletError} from '../model'
import type {Actor,Authority} from '../auth'
import {readJob} from './store'

/** Parent HTTP door must additionally require CSRF and fresh step-up for this owner action. */
export async function recoverJob(db:D1Database,actor:Actor,authority:Authority,input:{id:string;action:'resolve'|'replay';reason:string},now=Date.now()) {
 if(actor.role!=='owner'||!authority?.sql||!Array.isArray(authority.params))throw new MalletError('FORBIDDEN','The current owner must recover background jobs.',403)
 if(!input||typeof input.id!=='string'||!['resolve','replay'].includes(input.action)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>2000)throw new MalletError('JOB_INPUT','Choose a job, recovery action and reason.',400)
 // No external request can be proven unaccepted by local status alone. Only never-dispatched failures may replay.
 const condition=input.action==='resolve'?"status IN ('failed','uncertain')":"status='failed' AND dispatched_at IS NULL"
 const status=input.action==='resolve'?'resolved':'pending'
 try{await db.batch([
  db.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active') AND EXISTS(SELECT 1 FROM mallet_jobs WHERE id=? AND ${condition}) THEN 1 ELSE 0 END`).bind(...authority.params,actor.id,input.id),
  db.prepare('INSERT INTO mallet_job_recoveries(id,job_id,action,actor_json,reason,previous_outcome,previous_attempts,at) SELECT ?,?,?,?,?,outcome,attempts,? FROM mallet_jobs WHERE id=?').bind(crypto.randomUUID(),input.id,input.action,JSON.stringify({id:actor.id,name:actor.name,role:actor.role}),input.reason.trim(),now,input.id),
  db.prepare(`UPDATE mallet_jobs SET status=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND ${condition}`).bind(status,now,input.id),
  db.prepare('DELETE FROM mallet_assert')
 ])}catch(error){if(/CHECK constraint failed/.test(String(error)))throw new MalletError('JOB_RECOVERY','Authority changed or recovery would risk resending a provider request. Inspect the recorded outcome.',409);throw error}
 return readJob(db,input.id)
}
