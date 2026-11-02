import {choice,fail,object,text,type Row} from './model'
export const assetTypes=[['vehicle','Vehicle'],['bicycle','Bicycle'],['equipment','Equipment'],['device','Device']] as [string,string][]
export const assetType=(asset:any):string=>asset.assetType??'vehicle'
export const assetTypeName=(asset:any)=>!asset.assetType?'Legacy asset':assetTypes.find(([id])=>id===assetType(asset))?.[1]??'Vehicle'
export const specificationFields={vehicle:[],bicycle:['frame','components'],equipment:['model'],device:['model','imei','accessories']} as const
export const specificationLabels:Record<string,string>={frame:'Frame specification',components:'Component specifications',model:'Model',imei:'IMEI (if present)',accessories:'Expected accessories'}
export function typedAssetFields(p:any,previous?:Row){
 const type=choice(p.assetType??previous?.assetType??'vehicle',['vehicle','bicycle','equipment','device'],'asset type')
 if(previous?.assetType&&previous.visits?.length&&type!==assetType(previous))fail('ASSET_TYPE','An asset with visits keeps its type; create a separate asset for a different item.')
 const input=object(p.specifications??previous?.specifications??{},'specifications'),allowed:readonly string[]=specificationFields[type]
 if(Object.keys(input).some(key=>!allowed.includes(key)))fail('INPUT','Use only specifications for the selected asset type.',null,400)
 const specifications=Object.fromEntries(allowed.map(key=>[key,text(input[key],specificationLabels[key],key==='components'||key==='accessories'?2000:200,true)]))
 return {assetType:type,specifications}
}
export function assetSnapshot(asset:any){
 return {customerName:asset.customerName,customerEmail:asset.customerEmail,label:asset.label,identifier:asset.identifier,...(asset.assetType?{assetType:asset.assetType,specifications:structuredClone(asset.specifications??{})}:{})}
}
// Vehicles retain the existing mileage-out gate. Equipment uses observed hours;
// bicycle and device returns have no invented odometer reading.
export const requiresReturnReading=(asset:any)=>['vehicle','equipment'].includes(assetType(asset))
