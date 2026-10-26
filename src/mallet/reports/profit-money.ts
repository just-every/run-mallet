import {fail} from '../model'
export function sum(values:number[]){const n=values.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(n))fail('MONEY','The report amount is too large.',null,400);return n}
export function round(n:number,d:number){
 if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d)||d<=0)fail('MONEY','The report amount is too large.',null,400)
 const a=BigInt(Math.abs(n)),b=BigInt(d),v=Number((a*2n+b)/(b*2n))
 return n<0?-v:v
}
/** Cumulative allocation preserves the exact source cents, including the final remainder. */
export function allocate(cents:number,weights:number[]){
 const total=sum(weights)
 if(!total)return weights.map(()=>0)
 let prior=0,used=0
 return weights.map(w=>{used+=w;const next=round(cents*used,total),value=next-prior;prior=next;return value})
}
export const margin=(sales:number,cost:number|null)=>({revenueCents:sales,costCents:cost,grossProfitCents:cost===null?null:sales-cost,marginBps:cost===null||sales<=0?null:round((sales-cost)*10000,sales)})
export type CostEvent={kind:string;sourceId:string;at:string;amountCents:number;category:string;service:string;supplier:string;technicianId:string;detail:any}
export type ProfitLine={key:string;estimateId:string;revision:number;lineId:string;description:string;category:string;supplier:string;quantityMilli:number;estimatedRevenueCents:number;estimatedCostCents:number|null;realizedRevenueCents:number}
