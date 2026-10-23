import {assetTypes} from '../asset-types'
import {box,e,field,form,money,rows} from './common'
import {human,type Actor} from '../auth'

export function taxFields(settings?:any,prefix='') {
 return `<p>All prices and totals are in USD. Enter your shop's combined state and local sales tax rate, including 0 for a zero rate.</p>${field(prefix+'Sales tax rate (%)','ratePercent','number',settings?.ratePercent??'','required min="0" max="100" step="0.0001"')}<div class="checks"><label class="check"><input type="checkbox" name="partsTaxable" value="yes"${settings?.partsTaxable!==false?' checked':''}> ${e(prefix)}Parts are taxable</label><label class="check"><input type="checkbox" name="laborTaxable" value="yes"${settings?.laborTaxable?' checked':''}> ${e(prefix)}Labor is taxable</label></div><p class="muted">Use the tax treatment that applies to your shop. Sales tax is rounded to the nearest cent on each line.</p>`
}
export function taxSummary(state:any,type?:string) {
 const settings=rows(state,'taxSettings').find(r=>r.id==='shop-tax:'+type)??rows(state,'taxSettings').find(r=>r.id==='shop-tax')
 return settings?.ratePercent==null?'Set your shop sales tax rate before preparing an estimate.':`${e(settings.ratePercent)}% sales tax · parts ${settings.partsTaxable?'taxable':'exempt'} · labor ${settings.laborTaxable?'taxable':'exempt'}. All amounts USD.`
}
export function taxNotice(state:any,actor:Actor) {
 return human(actor)&&rows(state,'taxSettings')[0]?.ratePercent==null?box('Set your shop sales tax',`<p>Enter your rate before preparing new estimates. Existing estimates and invoices keep their recorded amounts.</p><p><a href="/app/tax">Set sales tax rate</a></p>`):''
}
export function taxPage(state:any,saved=false) {
 const settings=rows(state,'taxSettings'),base=settings.find(r=>r.id==='shop-tax')
 const typed=assetTypes.map(([id,name])=>{const rule=settings.find(r=>r.id==='shop-tax:'+id);return `<details><summary>${e(name)} tax rule${rule?' · '+e(rule.ratePercent)+'%':' · uses shop default'}</summary>${form('tax.configure',taxFields(rule??base,name+' '),'Save '+name.toLowerCase()+' tax rule',{assetType:id})}</details>`}).join('')
 return box('Sales tax settings',`${saved?'<p role="status">Sales tax settings saved.</p>':''}${form('tax.configure',taxFields(base),'Save sales tax settings')}<p>Changes apply to newly prepared estimates and revisions. Approved work and invoices retain their original rates and amounts.</p>`)+box('Tax by asset type',`<p>Each type uses the shop default until you save its own rate and parts/labor taxability. An explicit rule keeps its saved values when the shop default changes. Mallet does not infer jurisdiction or tax treatment from an asset.</p>${typed}`)
}

export const lineTax=(line:any)=>line.taxable?`${e(line.taxRatePercent)}% sales tax ${money(line.salesTaxCents)}`:'Sales tax exempt'
export const invoiceTotals=(totals:any)=>`<p class="totals"><span>Subtotal ${money(totals.subtotalCents)} · Sales tax ${money(totals.salesTaxCents)}</span><strong>Total ${money(totals.totalCents)} USD</strong></p>`
