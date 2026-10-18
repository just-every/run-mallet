import { bump, fail, rows, type Handler, type Row, type State } from './model'

export type TaxSettings = { currency: 'USD'; ratePercent: number; rateMillionths: number; partsTaxable: boolean; laborTaxable: boolean }
const settingsId = 'shop-tax'

/** A percentage has four decimal places; its fractional rate has six. */
export function taxRate(value: unknown): { ratePercent: number; rateMillionths: number } {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100 || Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001) fail('INPUT', 'Sales tax rate must be from 0 to 100 percent with at most four decimal places.', null, 400)
  return { ratePercent: value, rateMillionths: Math.round(value * 10000) }
}
export function configuredTax(s: State): TaxSettings {
  const settings = rows(s, 'taxSettings').find(row => row.id === settingsId)
  if (!settings || settings.ratePercent === null || settings.ratePercent === undefined) fail('TAX_NOT_CONFIGURED', 'Set the shop sales tax rate before preparing an estimate. Enter 0 if no sales tax applies.')
  return settings as Row & TaxSettings
}
export const tax: Handler = (c, command, p) => {
  if (command !== 'tax.configure') return
  const rate = taxRate(p.ratePercent)
  for (const key of ['partsTaxable', 'laborTaxable']) if (p[key] !== undefined && typeof p[key] !== 'boolean') fail('INPUT', `${key} must be true or false.`, null, 400)
  const settings = { currency: 'USD', ...rate, partsTaxable: p.partsTaxable ?? true, laborTaxable: p.laborTaxable ?? false, configuredBy: { id: c.actor.id, name: c.actor.name, role: c.actor.role }, configuredAt: c.now }
  const existing = rows(c.s, 'taxSettings').find(row => row.id === settingsId)
  if (existing) return bump(c.s, 'taxSettings', existing, settings)
  const row = { ...settings, id: settingsId, version: 1 }
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
