import {rows,type State} from '../model'
import {write,type CustomerScope} from './store'
/** Private drafts are personal content, not signed repair decisions. */
export function eraseConversationContent(state:State,scope:CustomerScope,at:string){
 return rows(state,'conversationDraft').filter(r=>scope.jobIds.has(r.jobId)&&!r.privacyErasedAt).map(row=>write('conversationDraft',{...row,version:row.version+1,captureReference:'erased-'+row.id,question:'',evidence:'',revisions:[],reviews:[],privacyErasedAt:at}))
}
