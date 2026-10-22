import { canonicalJson } from '@runeditrun/rer/modules/portability'
import { refuse } from './validate-staged.mjs'
export const insist=(ok,code)=>{if(!ok)refuse('finance_'+code)}
export const whole=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max
export const same=(a,b)=>canonicalJson(a)===canonicalJson(b)
export const actor=(value,roles)=>value&&typeof value.id==='string'&&value.id.length>0&&typeof value.name==='string'&&roles.includes(value.role)
export function normalized(value){
 if(!value||typeof value!=='object')return value
 if(Array.isArray(value))return value.map(normalized)
 const result=Object.fromEntries(Object.entries(value).map(([key,v])=>[key,normalized(v)]))
 if(Object.hasOwn(result,'gst')){result.taxable=result.gst;result.taxRatePercent=10;result.taxRateMillionths=100000;delete result.gst}
 if(Object.hasOwn(result,'gstCents')){result.salesTaxCents=result.gstCents;delete result.gstCents}
 if(result.currency==='AUD')result.currency='USD'
 if(result.kind==='labour')result.kind='labor'
 return result
}
export const parsed=value=>normalized(JSON.parse(value))
const rounded=(n,d)=>{const result=Number((n+d/2n)/d);insist(whole(result),'amount_overflow');return result}
export const portion=(cents,n,d)=>rounded(BigInt(cents)*BigInt(n),BigInt(d))
export function linePrice(line){
 insist(line&&typeof line==='object'&&typeof line.id==='string'&&line.id.length>0&&['part','labor','fee'].includes(line.kind),'line_shape')
 insist(whole(line.quantityMilli,1,1_000_000_000)&&line.quantity===line.quantityMilli/1000&&whole(line.unitCents,0,1_000_000_000)&&whole(line.unitDiscountCents??0,0,line.unitCents),'line_quantity_price')
 insist(typeof line.taxable==='boolean'&&whole(line.taxRateMillionths,0,1_000_000)&&typeof line.taxRatePercent==='number'&&Math.abs(line.taxRatePercent*10000-line.taxRateMillionths)<0.000001,'line_tax')
 if(line.costCents!==undefined)insist(whole(line.costCents,0,1_000_000_000),'line_cost')
 const subtotalCents=rounded(BigInt(line.quantityMilli)*BigInt(line.unitCents-(line.unitDiscountCents??0)),1000n)
 const salesTaxCents=line.taxable?rounded(BigInt(subtotalCents)*BigInt(line.taxRateMillionths),1000000n):0
 const result={subtotalCents,salesTaxCents,totalCents:subtotalCents+salesTaxCents}
 insist(whole(result.totalCents)&&Object.entries(result).every(([key,v])=>line[key]===v),'line_cents')
 return result
}
export function sumLines(lines){
 const result={currency:'USD',subtotalCents:0,salesTaxCents:0,totalCents:0}
 for(const line of lines)for(const key of ['subtotalCents','salesTaxCents','totalCents']){insist(whole(line[key]),'line_amount');result[key]+=line[key];insist(whole(result[key]),'total_overflow')}
 return result
}
export function priced(lines,total){
 insist(Array.isArray(lines)&&lines.length>0,'lines')
 for(const line of lines)linePrice(line)
 insist(same(sumLines(lines),total),'totals')
}
export function approved(revision){
 const value=revision.approval
 insist(value&&actor(value.by,['owner','admin']),'approval_actor')
 insist(!(revision.preparedBy?.role==='agent'&&revision.preparedBy.id===value.by.id),'self_approval')
}
