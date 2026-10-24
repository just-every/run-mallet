import {price,totals} from './money'
import { bump, choice, event, expectVersion, fail, find, put, text, who, rows, integer, type Handler, type Row, type State } from './model'

export type TaxSettings = { currency: 'USD'; ratePercent: number; rateMillionths: number; partsTaxable: boolean; laborTaxable: boolean }
const settingsId = 'shop-tax'

/** A percentage has four decimal places; its fractional rate has six. */
export function taxRate(value: unknown): { ratePercent: number; rateMillionths: number } {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100 || Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001) fail('INPUT', 'Sales tax rate must be from 0 to 100 percent with at most four decimal places.', null, 400)
  return { ratePercent: value, rateMillionths: Math.round(value * 10000) }
}
export function configuredTax(s: State, assetType?: string): TaxSettings {
  const settings = (assetType ? rows(s, 'taxSettings').find(row => row.id === settingsId+':'+assetType) : undefined) ?? rows(s, 'taxSettings').find(row => row.id === settingsId)
  if (!settings || settings.ratePercent === null || settings.ratePercent === undefined) fail('TAX_NOT_CONFIGURED', 'Set the shop sales tax rate before preparing an estimate. Enter 0 if no sales tax applies.')
  return settings as Row & TaxSettings
}
/** Supplies use discounted pre-tax extension, half-up cents, then the saved cap. */
export function suppliesCalculation(rule:Row,priced:any[]){
 const baseCents=priced.filter(l=>rule.basis==='parts and labor'?['part','labor'].includes(l.kind):l.kind===(rule.basis==='parts'?'part':'labor')).reduce((n,l)=>n+l.subtotalCents,0)
 const amountCents=Math.min(rule.capCents,rule.mode==='fixed'?rule.fixedCents:Number((BigInt(baseCents)*BigInt(rule.rateBps)+5000n)/10000n))
 return {baseCents,amountCents}
}
/** Discounts round each remaining unit price half up before quantity extension. */
export function discountCalculation(rule:Row,priced:any[]){
 return priced.map(l=>{
  if(!(rule.basis==='parts and labor'?['part','labor'].includes(l.kind):l.kind===(rule.basis==='parts'?'part':'labor')))return l
  const remaining=l.unitCents-(l.unitDiscountCents??0),addedUnitDiscountCents=Number((BigInt(remaining)*BigInt(rule.rateBps)+5000n)/10000n)
  const next={...l,unitDiscountCents:(l.unitDiscountCents??0)+addedUnitDiscountCents,discountRule:{id:rule.id,name:rule.name,basis:rule.basis,rateBps:rule.rateBps,unitBeforeDiscountCents:remaining,addedUnitDiscountCents,legalBasis:rule.legalBasis}}
  return {...next,...price(next)}
 })
}
export const taxCommands=['tax.certificate','tax.assignJurisdiction','tax.suppliesRule','tax.discountRule','tax.adjustEstimate']
export function certificateState(row:Row,now:string){return now.slice(0,10)<row.validFrom?'not yet effective':now.slice(0,10)>row.expiresOn?'expired':'within recorded dates'}
const date=(value:unknown,label:string)=>{const v=text(value,label,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail('INPUT','Use a valid UTC calendar date.',null,400);return v}
export function jurisdictionReport(s:State){
 const groups=new Map<string,any>()
 for(const invoice of rows(s,'invoice').filter(i=>['approved','exported'].includes(i.status))){
  const assignment=rows(s,'taxJurisdiction').find(r=>r.invoiceId===invoice.id),jurisdiction=assignment?.jurisdiction??'Unassigned - not filing ready'
  const credits=rows(s,'creditNote').filter(n=>n.invoiceId===invoice.id),reversedCents=credits.reduce((n,r)=>n+r.totals.salesTaxCents,0)
  const group=groups.get(jurisdiction)??{jurisdiction,invoicedTaxCents:0,reversedTaxCents:0,netTaxCents:0,invoices:[]}
  group.invoicedTaxCents+=invoice.totals.salesTaxCents;group.reversedTaxCents+=reversedCents;group.netTaxCents+=invoice.totals.salesTaxCents-reversedCents
  group.invoices.push({invoiceId:invoice.id,number:invoice.number,jobId:invoice.jobId,taxCents:invoice.totals.salesTaxCents,reversedCents,assignmentId:assignment?.id??null,creditNoteIds:credits.map(n=>n.id)})
  groups.set(jurisdiction,group)
 }
 return {currency:'USD',basis:'Invoice tax less issued credit-note reversals; this is not a cash-collected tax return or legal filing advice.',groups:[...groups.values()].sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction))}
}
export const tax: Handler = (c, command, p) => {
 if(taxCommands.includes(command)){
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner retains tax certificates and assigns filing jurisdictions.',null,403)
  if(command==='tax.discountRule'){
   const row=put(c.s,'taxDiscountRule',{name:text(p.name,'discount name'),basis:choice(p.basis,['parts','labor','parts and labor'],'discount basis'),rateBps:integer(p.rateBps,'discount basis points',0,10000),legalBasis:text(p.legalBasis,'owner-reviewed discount basis',2000),by:who(c),at:c.now})
   event(c,command,null,row.id,{name:row.name});return row
  }
  if(command==='tax.suppliesRule'){
   const category=choice(p.category??'supplies',['supplies','disposal','environmental','surcharge'],'fee category'),mode=choice(p.mode??'percentage',['percentage','fixed'],'fee calculation'),fixedCents=mode==='fixed'?integer(p.fixedCents,'fixed fee in USD cents'):0
   const row=put(c.s,'taxFeeRule',{category,mode,fixedCents,name:text(p.name,'supplies fee name'),basis:choice(p.basis,['parts','labor','parts and labor'],'supplies basis'),rateBps:integer(p.rateBps,'fee basis points',0,10000),capCents:integer(p.capCents,'fee cap in USD cents',0),taxable:p.taxable===true,legalBasis:text(p.legalBasis,'owner-reviewed legal basis',2000),by:who(c),at:c.now})
   if(typeof p.taxable!=='boolean')fail('INPUT','Declare supplies fee tax treatment.',null,400)
   event(c,command,null,row.id,{name:row.name});return row
  }
  if(command==='tax.adjustEstimate'){
   const estimate=find(c.s,'estimate',p.estimateId);expectVersion(estimate,p.version)
   if(estimate.status!=='draft'||estimate.authorisation)fail('TAX_FROZEN','Only an unapproved draft can receive an explicit tax adjustment.')
   const old=estimate.revisions.at(-1),job=find(c.s,'job',estimate.jobId)
   if(!['booked','working'].includes(job.status)||old.taxAdjustment)fail('TAX_FROZEN','Use a fresh draft revision for a new tax review.')
   if(p.consent!==true)fail('TAX_CONSENT','Record explicit customer consent to the disclosed fee and exemption basis.')
   const evidence=text(p.evidence,'review and customer consent evidence',2000)
   if(!p.certificateId&&!p.feeRuleId&&!p.discountRuleId)fail('INPUT','Choose a certificate, shop fee or discount rule.',null,400)
   let priced=structuredClone(old.lines),certificate:any=null,fee:any=null,discount:any=null
   if(p.discountRuleId){
    const rule=find(c.s,'taxDiscountRule',p.discountRuleId);expectVersion(rule,p.discountVersion)
    const before=totals(priced);priced=discountCalculation(rule,priced)
    discount={ruleId:rule.id,name:rule.name,basis:rule.basis,rateBps:rule.rateBps,amountCents:before.subtotalCents-totals(priced).subtotalCents,legalBasis:rule.legalBasis}
   }
   if(p.feeRuleId){
    const rule=find(c.s,'taxFeeRule',p.feeRuleId);expectVersion(rule,p.feeVersion)
    if(priced.length>=100)fail('INPUT','The supplies fee would exceed 100 estimate lines.',null,400)
    const {baseCents,amountCents}=suppliesCalculation(rule,priced),settings=configuredTax(c.s,job.asset.assetType)
    fee={ruleId:rule.id,category:rule.category??'supplies',mode:rule.mode??'percentage',fixedCents:rule.fixedCents??0,name:rule.name,basis:rule.basis,baseCents,rateBps:rule.rateBps,capCents:rule.capCents,amountCents,legalBasis:rule.legalBasis}
    const line={id:crypto.randomUUID(),kind:'fee',description:rule.name,quantity:1,quantityMilli:1000,unitCents:amountCents,taxable:rule.taxable,taxRatePercent:settings.ratePercent,taxRateMillionths:settings.rateMillionths,pierItemId:null,suppliesFee:fee}
    priced.push({...line,...price(line)})
   }
   if(p.certificateId){
    const cert=find(c.s,'taxCertificate',p.certificateId),billing=rows(c.s,'customerBilling').find(b=>b.jobId===job.id)?.snapshot,asset=find(c.s,'asset',job.assetId)
    if(!billing||billing.accountId!==cert.accountId||asset.customerAccountId!==cert.accountId||find(c.s,'customerAccount',cert.accountId).mergedInto)fail('TAX_ACCOUNT','The certificate must belong to this repair’s unchanged billing account.')
    if(certificateState(cert,c.now)!=='within recorded dates')fail('TAX_EXPIRED','The certificate is outside its recorded inclusive UTC dates.')
    if(!priced.some((l:any)=>cert.scope==='all'||l.kind===(cert.scope==='parts'?'part':cert.scope==='fees'?'fee':'labor')))fail('TAX_SCOPE','The certificate scope covers no line in this reviewed draft.')
    certificate={id:cert.id,reference:cert.reference,jurisdiction:cert.jurisdiction,scope:cert.scope,validFrom:cert.validFrom,expiresOn:cert.expiresOn}
    priced=priced.map((l:any)=>cert.scope==='all'||l.kind===(cert.scope==='parts'?'part':cert.scope==='fees'?'fee':'labor')?{...l,taxable:false,exemption:certificate,...price({...l,taxable:false})}:l)
   }
   const next={...old,n:old.n+1,lines:priced,totals:totals(priced),approval:null,preparedBy:who(c),preparedAt:c.now,taxAdjustment:{certificate,fee,discount,evidence,by:who(c),at:c.now}}
   const saved=bump(c.s,'estimate',estimate,{revisions:[...estimate.revisions,next]})
   event(c,command,job.id,saved.id,{revision:next.n,certificateId:certificate?.id??null,feeRuleId:fee?.ruleId??null,discountRuleId:discount?.ruleId??null});return saved
  }
  if(command==='tax.certificate'){
   const account=find(c.s,'customerAccount',p.accountId);expectVersion(account,p.version)
   if(account.mergedInto)fail('TAX_ACCOUNT','Use the current customer account.')
   const validFrom=date(p.validFrom,'valid from'),expiresOn=date(p.expiresOn,'expires on')
   if(expiresOn<validFrom)fail('INPUT','Certificate expiry must not precede its start.',null,400)
   const scope=choice(p.scope,['parts','labor','fees','all'],'declared certificate scope')
   const row=put(c.s,'taxCertificate',{accountId:account.id,accountName:account.name,reference:text(p.reference,'certificate reference'),jurisdiction:text(p.jurisdiction,'certificate jurisdiction'),scope,validFrom,expiresOn,certificate:text(p.certificate,'exact certificate text',20000),evidence:text(p.evidence,'owner review evidence',2000),by:who(c),at:c.now})
   event(c,command,null,row.id,{accountId:account.id,scope,validFrom,expiresOn});return row
  }
  const invoice=find(c.s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
  if(!['approved','exported'].includes(invoice.status))fail('TAX_INVOICE','Approve the exact invoice before assigning its tax jurisdiction.')
  if(rows(c.s,'taxJurisdiction').some(r=>r.invoiceId===invoice.id))fail('TAX_JURISDICTION','This invoice already retains its immutable jurisdiction declaration.')
  const row=put(c.s,'taxJurisdiction',{invoiceId:invoice.id,jobId:invoice.jobId,invoiceRevision:invoice.revision,jurisdiction:text(p.jurisdiction,'owner-declared jurisdiction'),evidence:text(p.evidence,'jurisdiction review evidence',2000),by:who(c),at:c.now})
  event(c,command,invoice.jobId,row.id,{jurisdiction:row.jurisdiction});return row
 }
 if (command !== 'tax.configure') return
  const assetType = p.assetType === undefined || p.assetType === '' ? '' : choice(p.assetType,['vehicle','bicycle','equipment','device'],'asset tax type'), id = assetType ? settingsId+':'+assetType : settingsId
  const rate = taxRate(p.ratePercent)
  for (const key of ['partsTaxable', 'laborTaxable']) if (p[key] !== undefined && typeof p[key] !== 'boolean') fail('INPUT', `${key} must be true or false.`, null, 400)
  const settings = { currency: 'USD', ...(assetType?{assetType}:{}), ...rate, partsTaxable: p.partsTaxable ?? true, laborTaxable: p.laborTaxable ?? false, configuredBy: { id: c.actor.id, name: c.actor.name, role: c.actor.role }, configuredAt: c.now }
  const existing = rows(c.s, 'taxSettings').find(row => row.id === id)
  if (existing) return bump(c.s, 'taxSettings', existing, settings)
  const row = { ...settings, id, version: 1 }
  rows(c.s, 'taxSettings').push(row)
  return row
}

/** Upgrade restored archives too, without repricing a single historical amount. */
export function migrateSalesTax(s: State): void {
  function visit(value: any): void {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { for (const item of value) visit(item); return }
    if (Object.hasOwn(value, 'gst')) {
      value.taxable = value.gst
      value.taxRatePercent = 10
      value.taxRateMillionths = 100000
      delete value.gst
    }
    if (Object.hasOwn(value, 'gstCents')) { value.salesTaxCents = value.gstCents; delete value.gstCents }
    if (value.currency === 'AUD') value.currency = 'USD'
    if (value.kind === 'labour') value.kind = 'labor'
    for (const item of Object.values(value)) visit(item)
  }
  for (const records of Object.values(s.records)) for (const row of records) {
    visit(row)
    if (row.format === 'mallet-invoice-csv' && typeof row.csv === 'string') {
      const end = row.csv.indexOf('\r\n')
      if (end !== -1) {
        const header = row.csv.slice(0, end).replace('"UnitAUD"', '"UnitUSD"').replace('"SubtotalAUD"', '"SubtotalUSD"').replace('"GSTAUD"', '"SalesTaxUSD"').replace('"TotalAUD"', '"TotalUSD"')
        row.csv = header + row.csv.slice(end).replaceAll(',"AUD"\r\n', ',"USD"\r\n')
      }
    }
  }
  if (!rows(s, 'taxSettings').some(row => row.id === settingsId)) rows(s, 'taxSettings').push({ id: settingsId, version: 1, currency: 'USD', ratePercent: null, rateMillionths: null, partsTaxable: true, laborTaxable: false })
}
