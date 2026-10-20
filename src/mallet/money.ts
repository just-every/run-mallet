import { choice, fail, integer, object, text } from './model'
import type { TaxSettings } from './tax'

export type Line = { id: string; kind: 'part' | 'labor' | 'fee'; costCents?: number; unitDiscountCents?: number; description: string; quantity: number; quantityMilli: number; unitCents: number; taxable: boolean; taxRatePercent: number; taxRateMillionths: number; pierItemId: string | null; subtotalCents: number; salesTaxCents: number; totalCents: number }
export function quantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000 || Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001) fail('INPUT', 'Quantity must be positive with at most three decimal places, up to 1,000,000.', null, 400)
  return Math.round(value * 1000)
}
function rounded(numerator: bigint, denominator: bigint): number {
  const result = Number((numerator + denominator / 2n) / denominator)
  if (!Number.isSafeInteger(result)) fail('MONEY', 'The amount is too large.', null, 400)
  return result
}
/** Round each extended price, then each line's sales tax, half up to whole cents. */
export function price(line: Pick<Line, 'quantityMilli' | 'unitCents' | 'taxable' | 'taxRateMillionths' | 'unitDiscountCents'>) {
  const subtotalCents = rounded(BigInt(line.quantityMilli) * BigInt(line.unitCents - (line.unitDiscountCents ?? 0)), 1000n)
  const salesTaxCents = line.taxable ? rounded(BigInt(subtotalCents) * BigInt(line.taxRateMillionths), 1000000n) : 0
  const totalCents = subtotalCents + salesTaxCents
  if (!Number.isSafeInteger(totalCents)) fail('MONEY', 'The amount is too large.', null, 400)
  return { subtotalCents, salesTaxCents, totalCents }
}
export function lines(value: unknown, settings: TaxSettings): Line[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) fail('INPUT', 'Provide 1–100 estimate lines.', null, 400)
  const priced = value.map((raw, i) => {
    const p = object(raw, `lines[${i}]`), quantityMilli = quantity(p.quantity)
    if ('taxable' in p || 'gst' in p || 'taxRatePercent' in p || 'taxRateMillionths' in p) fail('INPUT', 'Line sales tax comes from the shop tax settings.', null, 400)
    const kind = choice(p.kind === 'labour' ? 'labor' : p.kind, ['part', 'labor', 'fee'] as const, 'line kind')
    const line = { id: p.id === undefined ? crypto.randomUUID() : text(p.id, 'line id'), kind, description: text(p.description, 'description', 500), quantity: quantityMilli / 1000, quantityMilli, unitCents: integer(p.unitCents, 'unitCents'), taxable: kind === 'fee' ? p.feeTaxable : kind === 'part' ? settings.partsTaxable : settings.laborTaxable, taxRatePercent: settings.ratePercent, taxRateMillionths: settings.rateMillionths, pierItemId: p.pierItemId === undefined || p.pierItemId === null ? null : text(p.pierItemId, 'pierItemId') }
    if (kind === 'fee' && typeof p.feeTaxable !== 'boolean') fail('INPUT', 'Choose whether this fee is taxable.', null, 400)
    const cost = p.costCents === undefined ? {} : {costCents: integer(p.costCents, 'costCents')}
    const discount = p.unitDiscountCents === undefined ? {} : {unitDiscountCents: integer(p.unitDiscountCents, 'unitDiscountCents', 0, line.unitCents)}
    if (line.kind !== 'part' && line.pierItemId) fail('INPUT', 'Only parts reference Pier items.', null, 400)
    return { ...line, ...cost, ...discount, ...price({...line, ...discount}) }
  })
  if (new Set(priced.map(line => line.id)).size !== priced.length) fail('INPUT', 'Line ids must be unique.', null, 400)
  return priced
}
export function totals(priced: Pick<Line, 'subtotalCents' | 'salesTaxCents' | 'totalCents'>[]) {
  const sum = { subtotalCents: 0, salesTaxCents: 0, totalCents: 0 }
  for (const line of priced) for (const key of ['subtotalCents', 'salesTaxCents', 'totalCents'] as const) {
    sum[key] += line[key]
    if (!Number.isSafeInteger(sum[key])) fail('MONEY', 'The invoice total is too large.', null, 400)
  }
  return { currency: 'USD', ...sum }
}
