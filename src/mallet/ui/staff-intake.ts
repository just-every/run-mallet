import {assetFormFields} from './asset-types'
import {box,field,form,select} from './common'

export function staffIntakeForms(records:Record<string,any[]>,technicians:{id:string;name:string}[]){
 return box('Customer intake',`<details><summary>Register a customer vehicle</summary>${form('asset.create',assetFormFields({},'vehicle'),'Register vehicle')}</details><details><summary>Book a repair visit</summary>${form('job.book',select('Customer vehicle','staffAsset',(records.asset??[]).map(a=>[JSON.stringify({assetId:a.id,version:a.version}),a.label+' · '+a.identifier]))+field('Repair request','title','text','','required')+field('Repair bay','bayId','text','','required')+select('Assigned technician','technicianId',technicians.map(t=>[t.id,t.name]))+field('Visit starts (with timezone)','startAt','text','','required')+field('Visit ends (with timezone)','endAt','text','','required'),'Book repair visit')}</details>`)
}
