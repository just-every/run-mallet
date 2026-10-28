/** Keep identifiers and actual clearance history while removing copied customer detail. */
const title=(kind:string)=>({evidence:'Evidence requirement',consent:'Customer decision requirement',backorder:'Physical receiving requirement'}[kind]??'Source requirement')
export function privateBlockerProjection<T extends {blockers:any[];nextAction:any}>(value:T):T{
 return {...value,blockers:value.blockers.map(b=>({...b,title:title(b.kind)})),nextAction:value.nextAction?{...value.nextAction,...(value.nextAction.requirements?{requirements:['Review the current quality source.']}:{} )}:null}
}
export function privateBlockerRecord(kind:string,row:any,at:string){
 if(kind==='repairBlockerPacket')return {...row,privacyErasedAt:at,revisions:row.revisions.map(privateBlockerProjection)}
 const acknowledgment=(a:any)=>a?{...a,note:'Customer detail erased; acknowledgment attribution retained.'}:a
 if(kind==='repairBlockerTask')return {...row,privacyErasedAt:at,acknowledgment:acknowledgment(row.acknowledgment),acknowledgments:row.acknowledgments.map(acknowledgment),resolution:row.resolution?{...row.resolution,reason:'Actual source condition cleared; customer detail erased.'}:null}
 if(kind==='event'&&row.kind.startsWith('blocker.'))return {...row,data:{...row.data,...(row.data.acknowledgment?{acknowledgment:acknowledgment(row.data.acknowledgment)}:{}),...(row.kind==='blocker.cleared'?{reason:'Actual source condition cleared; customer detail erased.'}:{})}}
 return row
}
