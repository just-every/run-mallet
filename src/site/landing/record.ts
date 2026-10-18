// The one repair order the homepage follows, RO 4127 at Buckeye Auto Repair in Columbus, Ohio, on Mon Oct 19, 2026,
// and the shop's week around it. Every figure a section shows is computed here once, so the same record reads the same
// in every section and every total adds up (desk STRUCTURE.md, "Records that must agree across screens").

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const whole = new Intl.NumberFormat('en-US')

/** Cents to "$1,234.50". */
export const usd = (cents: number) => dollars.format(cents / 100)
/** A count with thousands separators: 31906 → "31,906". */
export const count = (value: number) => whole.format(value)
/** Tenths of an hour to "2.4". */
export const hours = (tenths: number) => (tenths / 10).toFixed(1)

export const shop = { name: 'Buckeye Auto Repair', place: 'Columbus, OH', county: 'Franklin County', taxPercent: 7.5, laborRateCents: 13_500 }

const tax = (cents: number) => Math.round((cents * shop.taxPercent) / 100)

// The estimate Dana approves at 9:24 am: MOTOR labor times at the shop rate, parts in stock at Worldpac.
const padsWorldpac = 5_845, padsMorseRd = 6_685, rotor = 4_190, fluid = 1_995
const laborTenths = 16 + 8
const labor = (laborTenths * shop.laborRateCents) / 10
const partsFirst = padsWorldpac + 2 * rotor + fluid
const partsNow = padsMorseRd + 2 * rotor + fluid
const subtotal = labor + partsNow

export const ro = {
  number: 'RO 4127',
  invoice: '10418',
  customer: 'Dana Brooks',
  vehicle: '2019 Honda CR-V',
  trim: '2019 Honda CR-V EX · 1.5L turbo I4 · AWD · CVT',
  plate: 'OH JKV 4471',
  vin: '5J6RW2H52KL014382',
  milesIn: '62,100 mi',
  // 7.8 mi of test drive at inspection and the 4.2 mi road test: 62,100 + 12 = 62,112 out.
  testDrive: '7.8 mi',
  roadTest: '4.2 mi',
  milesOut: '62,112 mi',
  advisor: 'Kayla Ortiz',
  tech: 'Luis Romero',
  laborHours: hours(laborTenths),
  motorBrakes: hours(16),
  motorFluid: hours(8),
  labor: usd(labor),
  partsFirst: usd(partsFirst),
  brakesFirst: usd(labor + partsFirst),
  padsWorldpac: usd(padsWorldpac),
  padsMorseRd: usd(padsMorseRd),
  padsDelta: `+${usd(padsMorseRd - padsWorldpac)}`,
  partsNow: usd(partsNow),
  brakesNow: usd(subtotal),
  tax: usd(tax(subtotal)),
  total: usd(subtotal + tax(subtotal)),
  filter: usd(6_480),
  filterDue: '67,000 mi',
  rate: usd(shop.laborRateCents),
}

// The week of Oct 19 – 23 as Saturday's report sends it.
const techs = [
  { name: 'Luis Romero', sold: 468, clocked: 415 },
  { name: 'Andre Wallace', sold: 441, clocked: 400 },
  { name: 'Mei Lin', sold: 396, clocked: 400 },
  { name: 'Jake Kowalski', sold: 352, clocked: 385 },
  { name: 'Chris Novak', sold: 289, clocked: 320 },
]
const carsByDay = [['Mon', 21], ['Tue', 19], ['Wed', 18], ['Thu', 20], ['Fri', 18]] as const
const cars = carsByDay.reduce((sum, [, n]) => sum + n, 0)
const soldTenths = techs.reduce((sum, t) => sum + t.sold, 0)
const clockedTenths = techs.reduce((sum, t) => sum + t.clocked, 0)
const weekLabor = (soldTenths * shop.laborRateCents) / 10
const weekParts = 2_291_940
const weekSales = weekLabor + weekParts
const efficiency = (sold: number, clocked: number) => `${Math.round((100 * sold) / clocked)}%`

export const week = {
  cars,
  carsByDay,
  movedAhead: 5,
  onPromise: `${cars - 5} of ${cars}`,
  sales: usd(weekSales),
  aro: usd(Math.round(weekSales / cars)),
  labor: usd(weekLabor),
  parts: usd(weekParts),
  bookedBack: usd(694_000),
  followUps: 41,
  booked: 12,
  techs: techs.map(t => ({ name: t.name, sold: hours(t.sold), clocked: hours(t.clocked), efficiency: efficiency(t.sold, t.clocked) })),
  shop: { sold: hours(soldTenths), clocked: hours(clockedTenths), efficiency: efficiency(soldTenths, clockedTenths) },
}
