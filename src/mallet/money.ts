import { choice, fail, integer, object, text } from './model'

export type Line = { id: string; kind: 'part' | 'labour'; description: string; quantity: number; quantityMilli: number; unitCents: number; gst: boolean; pierItemId: string | null; subtotalCents: number; gstCents: number; totalCents: number }
export function quantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000 || Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001) fail('INPUT', 'Quantity must be positive with at most three decimal places, up to 1,000,000.', null, 400)
  return Math.round(value * 1000)
}
function rounded(numerator: bigint, denominator: bigint): number {
  const result = Number((numerator + denominator / 2n) / denominator)
  if (!Number.isSafeInteger(result)) fail('MONEY', 'The amount is too large.', null, 400)
  return result
}
export function price(line: Pick<Line, 'quantityMilli' | 'unitCents' | 'gst'>) {
  const subtotalCents = rounded(BigInt(line.quantityMilli) * BigInt(line.unitCents), 1000n)
  const gstCents = line.gst ? rounded(BigInt(subtotalCents), 10n) : 0
  const totalCents = subtotalCents + gstCents
  if (!Number.isSafeInteger(totalCents)) fail('MONEY', 'The amount is too large.', null, 400)
  return { subtotalCents, gstCents, totalCents }
}
export function lines(value: unknown): Line[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) fail('INPUT', 'Provide 1–100 estimate lines.', null, 400)
  const priced = value.map((raw, i) => {
    const p = object(raw, `lines[${i}]`), quantityMilli = quantity(p.quantity)
    if (p.gst !== undefined && typeof p.gst !== 'boolean') fail('INPUT', 'gst must be true or false.', null, 400)
    const line = { id: p.id === undefined ? crypto.randomUUID() : text(p.id, 'line id'), kind: choice(p.kind, ['part', 'labour'] as const, 'line kind'), description: text(p.description, 'description', 500), quantity: quantityMilli / 1000, quantityMilli, unitCents: integer(p.unitCents, 'unitCents'), gst: p.gst !== false, pierItemId: p.pierItemId === undefined || p.pierItemId === null ? null : text(p.pierItemId, 'pierItemId') }
    if (line.kind === 'labour' && line.pierItemId) fail('INPUT', 'Only parts reference Pier items.', null, 400)
    return { ...line, ...price(line) }
  })
  if (new Set(priced.map(line => line.id)).size !== priced.length) fail('INPUT', 'Line ids must be unique.', null, 400)
  return priced
}
export function totals(priced: Pick<Line, 'subtotalCents' | 'gstCents' | 'totalCents'>[]) {
  const sum = { subtotalCents: 0, gstCents: 0, totalCents: 0 }
  for (const line of priced) for (const key of ['subtotalCents', 'gstCents', 'totalCents'] as const) {
    sum[key] += line[key]
    if (!Number.isSafeInteger(sum[key])) fail('MONEY', 'The invoice total is too large.', null, 400)
  }
  return { currency: 'AUD', ...sum }
}
