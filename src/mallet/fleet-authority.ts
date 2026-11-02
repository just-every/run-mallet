import {customerBillingSnapshot} from './customers'
import {fail,find,text,who,type Context,type Row} from './model'
export function fleetApproval(c:Context,job:Row,p:any){
 const asset=find(c.s,'asset',job.assetId),billing=customerBillingSnapshot(c.s,asset)
 if(billing?.kind!=='fleet')return null
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner records reviewed fleet repair authority.',null,403)
 const account=find(c.s,'customerAccount',billing.accountId)
 if(!account.authorizerId||account.authorizerId===(asset.driverContactId??account.driverId)||p.authorizerId!==account.authorizerId||p.accountVersion!==account.version)fail('FLEET_AUTHORIZER','Review the unchanged current fleet account and its allowed authorizer; a driver cannot authorize repairs.')
 const authorizer=find(c.s,'contact',account.authorizerId)
 return {accountId:account.id,accountVersion:account.version,authorizer:{id:authorizer.id,name:authorizer.name,version:authorizer.version},po:text(p.po,'fleet purchase order'),evidence:text(p.fleetEvidence,'fleet approval evidence',2000),by:who(c),at:c.now,label:'Staff-reviewed fleet instruction; Mallet did not verify the fleet manager identity.'}
}
