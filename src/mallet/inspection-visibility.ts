import type {State} from './model'
/** Agent preparation keeps priced drafts without native diagnostic evidence. */
export function withoutInspectionSource(row:any) {
 if(!Array.isArray(row?.revisions))return row
 return {...row,revisions:row.revisions.map(({inspectionSource,...revision}:any)=>revision)}
}
export function withoutInspections(state:State):State {
 return {...state,records:Object.fromEntries(Object.entries(state.records).filter(([kind])=>!kind.startsWith('inspection')).map(([kind,values])=>[kind,kind==='event'?values.filter(row=>!row.kind.startsWith('inspection')):kind==='estimate'?values.map(withoutInspectionSource):values]))}
}
