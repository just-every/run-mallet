import {area,box,e,field,form,money,rows,select,when} from './common'

const raw=(data:FormData,key:string)=>String(data.get(key)??'').trim()
const number=(data:FormData,key:string)=>raw(data,key)===''?NaN:Number(raw(data,key))
const cents=(data:FormData,key:string)=>Math.round(number(data,key)*100)

export function pricingFormInput(data:FormData,input:any) {
 if(input.command!=='pricing.save')return input
 input.version=number(data,'version')
 if(!raw(data,'id'))delete input.id
 input.minimumCents=cents(data,'minimumUsd')
 input.roundingCents=number(data,'roundingCents')
 const count=number(data,'pricingBandCount')
 input.bands=Number.isInteger(count)&&count>0&&count<=100?Array.from({length:count},(_,index)=>index)
  .filter(index=>['From','To','Markup'].some(key=>raw(data,`band${key}${index}`)!==''))
  .map(index=>({fromCents:cents(data,`bandFrom${index}`),toCents:raw(data,`bandTo${index}`)===''?null:cents(data,`bandTo${index}`),markupBps:Math.round(number(data,`bandMarkup${index}`)*100)})):[]
 return input
}

function editor(jobId:string,matrix?:any) {
 const revision=matrix?.revisions.at(-1),bands=revision?.bands??[],count=Math.min(100,Math.max(4,bands.length+1))
 const controls=Array.from({length:count},(_,index)=>{
  const band=bands[index],initial=!matrix&&index===0
  return `<fieldset><legend>Pricing band ${index+1}</legend><div class="fields">${field('Cost from (USD, inclusive)',`bandFrom${index}`,'number',band?band.fromCents/100:initial?0:'','min="0" step="0.01"')}${field('Cost below (USD, exclusive; blank for final band)',`bandTo${index}`,'number',band?.toCents!=null?band.toCents/100:'','min="0" step="0.01"')}${field('Markup (%)',`bandMarkup${index}`,'number',band?band.markupBps/100:initial?0:'','min="0" step="0.01"')}</div></fieldset>`
 }).join('')
 return form('pricing.save',`${field('Matrix name','name','text',revision?.name??'','required maxlength="200"')}${select('Applies to','kind',[['part','Parts unit cost'],['labor','Labor base hourly cost']],revision?.kind??'part')}<div class="fields">${field('Minimum unit price / hourly rate (USD)','minimumUsd','number',revision?revision.minimumCents/100:0,'required min="0" step="0.01"')}${field('Round up to increment (cents)','roundingCents','number',revision?.roundingCents??1,'required min="1" step="1"')}</div><p>Cost plus markup rounds half up to a cent, then up to the chosen increment; the minimum applies afterwards. Start at zero, use adjoining bands and leave the final upper cost blank. Leave unused bands entirely blank.</p>${controls}${area('Reason for this revision','reason','','required maxlength="2000"')}`,matrix?'Save matrix revision':'Create pricing matrix',{jobId,version:matrix?.version??0,...(matrix?{id:matrix.id}:{}),pricingBandCount:count})
}

export function pricingPanel(state:any,jobId:string) {
 const matrices=rows(state,'pricingMatrix')
 return box('Service pricing',`<p>Saved estimates retain the exact pricing rules and any approved override. Updating a matrix changes future calculations.</p>${matrices.map(matrix=>{
  const current=matrix.revisions.at(-1)
  return `<details><summary>${e(current.name)} · ${e(current.kind)} · revision ${current.n}</summary>${editor(jobId,matrix)}<details><summary>Matrix history</summary><ul>${matrix.revisions.map((revision:any)=>`<li>Revision ${revision.n} · ${e(revision.name)} · ${e(revision.by.name)} · ${when(revision.at)} · ${e(revision.reason)}<ul>${revision.bands.map((band:any)=>`<li>${money(band.fromCents)} to ${band.toCents===null?'unbounded':`${money(band.toCents)} exclusive`} · ${e(band.markupBps/100)}% markup</li>`).join('')}</ul>Minimum ${money(revision.minimumCents)} · round up ${e(revision.roundingCents)} cents</li>`).join('')}</ul></details></details>`
 }).join('')}<details><summary>Create a pricing matrix</summary>${editor(jobId)}</details>`,{id:'pricing'})
}

export function recipePricingFields(state:any,line:any,index:number) {
 const kind=line?.kind??'part',matrices=rows(state,'pricingMatrix')
 const options:[string,string][]=[['','Use fixed unit price'],...matrices.map(matrix=>[matrix.id,`${matrix.revisions.at(-1).kind}: ${matrix.revisions.at(-1).name} · revision ${matrix.revisions.at(-1).n}`] as [string,string])]
 return `<div class="fields">${field('Base cost / hourly cost (USD)',`lineCost${index}`,'number',line?.costCents!=null?line.costCents/100:'','min="0" step="0.01"')}${select(`Pricing matrix`,`lineMatrix${index}`,options,line?.matrixId??'')}</div>`
}

export function recipePricingInput(data:FormData,index:number) {
 const matrixId=raw(data,`lineMatrix${index}`),cost=raw(data,`lineCost${index}`)
 if(!matrixId&&!cost)return {}
 return {costCents:cents(data,`lineCost${index}`),...(matrixId?{matrixId}:{})}
}

export function pricingOverrideFields(lines:any[]) {
 return lines.map((line,index)=>line.matrixId?`<fieldset><legend>${e(line.description)}: optional price override</legend>${field('Override unit price / hourly rate (USD)',`pricingOverride${index}`,'number','','min="0" step="0.01"')}${area('Override reason (required when overriding)',`pricingOverrideReason${index}`,'','maxlength="2000"')}</fieldset>`:'').join('')+`<input type="hidden" name="pricingOverrideCount" value="${e(lines.length)}">`
}

export function pricingOverrideInput(data:FormData,input:any) {
 if(!['inspection.estimate','recipe.prepare'].includes(input.command))return input
 const count=number(data,'pricingOverrideCount')
 input.overrides=Number.isInteger(count)&&count>=0&&count<=100?Array.from({length:count},(_,index)=>index)
  .filter(index=>raw(data,`pricingOverride${index}`)!==''||raw(data,`pricingOverrideReason${index}`)!=='')
  .map(lineIndex=>({lineIndex,unitCents:cents(data,`pricingOverride${lineIndex}`),reason:raw(data,`pricingOverrideReason${lineIndex}`)})):[]
 return input
}
