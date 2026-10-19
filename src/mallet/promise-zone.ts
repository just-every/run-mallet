import {rows,type State} from './model'
export const DEFAULT_SHOP_ZONE='America/New_York'
export const promiseZoneSettings=(s:State)=>rows(s,'promiseSettings')[0]
export const shopTimeZone=(s:State)=>promiseZoneSettings(s)?.timeZone??DEFAULT_SHOP_ZONE
export function shopTime(at:string,timeZone:string):string {
 return new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(at))+` (${timeZone})`
}
