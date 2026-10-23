import {assetTypes,assetType,assetTypeName,specificationFields,specificationLabels} from '../asset-types'
import {box,e,field,form,hidden,select} from './common'
export function assetFormFields(a:any={},type=assetType(a)){
 const specification=a.specifications??{}
 return `<div class="fields">${field('Customer name','customerName','text',a.customerName,'required maxlength="200"')}${field('Customer email','customerEmail','email',a.customerEmail)}${field(type==='vehicle'?'Vehicle':'Asset label','label','text',a.label,'required maxlength="200"')}${field(type==='vehicle'?'Plate or VIN':'Serial or identifier','identifier','text',a.identifier,'required maxlength="100"')}${specificationFields[type as keyof typeof specificationFields].map(key=>field(specificationLabels[key],'spec:'+key,'text',specification[key],'maxlength="'+(key==='components'||key==='accessories'?2000:200)+'"')).join('')}</div>${a.id&&!a.assetType?select('Asset type','assetType',assetTypes,type):hidden('assetType',type)}`
}
export function assetDetails(asset:any){
 const specs=Object.entries(asset.specifications??{}).filter(([,value])=>value)
 return box('Asset details',`<p>${e(assetTypeName(asset))} · ${e(asset.identifier)}</p>${specs.length?`<dl>${specs.map(([key,value])=>`<dt>${e(specificationLabels[key]??key)}</dt><dd>${e(value)}</dd>`).join('')}</dl>`:''}`)
}
export function assetEdit(asset:any){return box('Edit asset details',`<p>Saved visits retain their original asset specifications. An explicitly typed asset with visits keeps its type. Legacy assets can be classified once; existing visits keep their original details.</p>${form('asset.update',assetFormFields(asset),'Save asset details',{assetId:asset.id,version:asset.version})}`)}
export function assetNativeInput(input:any){
 if(!['asset.create','asset.update'].includes(input.command))return
 const fields=Object.entries(input).filter(([key])=>key.startsWith('spec:'))
 input.specifications=Object.fromEntries(fields.map(([key,value])=>[key.slice(5),value]))
}
export const assetTypePicker=(selected:string)=>`<form method="get" action="/app/customers#add">${select('Asset type','type',assetTypes,selected)}<button>Choose asset type</button></form>`
