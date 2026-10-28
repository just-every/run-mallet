import {HttpError,type Actor,type Authority} from './auth'
import {execute,load} from './model'
import {conversationView} from './conversation-drafts'
function owner(actor:Actor,authority:Authority){
 if(actor.role!=='owner'||actor.staff)throw new HttpError(403,'owner_required')
 return {sql:'('+authority.sql+") AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",params:[...authority.params,actor.id]}
}
export function conversationCommand(db:D1Database,actor:Actor,authority:Authority,command:string,input:any){return execute(db,actor,command,input,owner(actor,authority))}
export async function readConversation(db:D1Database,actor:Actor,authority:Authority,jobId:string){
 const grant=owner(actor,authority),state=await load(db),view=conversationView(state,jobId)
 if(!await db.prepare('SELECT 1 AS ok FROM mallet_meta WHERE id=1 AND version=? AND ('+grant.sql+')').bind(state.version,...grant.params).first())throw new HttpError(409,'source_changed')
 return view
}
