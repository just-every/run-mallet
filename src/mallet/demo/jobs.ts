// The sample workshop's visits: ten weeks of collected history, today's bays and
// the coming week. Days count workdays from today (negative: earlier).
import type { Who } from './people'

export type Line = [kind: 'part' | 'labour', description: string, quantity: number, dollars: number]
export type Stage = 'booked' | 'draft' | 'sent' | 'authorised' | 'working' | 'completed' | 'invoiced'
type Tech = 'tom' | 'luis' | 'mia' | 'ken'
export type Visit = {
  asset: string; title: string; bay: string; tech: Tech; day: number; start: string; hours: number; stage: Stage
  lines?: Line[]
  /** Revision 2, prepared after revision 1 was shared and before the customer decided. */
  revise?: Line[]
  /** When the estimate was prepared, if not 30 minutes into the visit. */
  estimateAt?: [day: number, time: string]
  /** When revision 2 was prepared, if not 30 minutes after revision 1 was shared. */
  reviseAt?: [day: number, time: string]
  /** When the customer decided, if not 25 minutes after the estimate was shared. */
  decidedAt?: [day: number, time: string]
  preparedBy?: Who; approvedBy?: Who; bookedAhead?: number
  share?: 'phone' | 'email' | 'printed' | 'in person'
  authorise?: 'phone' | 'email reply' | 'in person' | 'signed'
  /** Lines the customer declined (indexes into the decided revision). */
  decline?: number[]
  /** Work recorded so far: [line index, quantity]. Finished visits default to every authorised line in full. */
  work?: [line: number, quantity: number][]
  invoice?: 'draft' | 'approved'; invoicedBy?: Who
  dispatch?: { by: Who; day: number; start: string; hours: number; bay: string; tech: Tech; reason: string; approvedBy?: Who }
}

const H = 145 // labour, AUD per hour excluding GST
const oil = (litres: string, dollars: number): Line[] => [['part', `Engine oil 5W-30 (${litres})`, 1, dollars], ['part', 'Oil filter', 1, 18.5]]
const logbook = (hours = 2): Line[] => [...oil('5 L', 68), ['part', 'Air filter', 1, 36], ['labour', 'Logbook service', hours, H]]
const diesel = (): Line[] => [['part', 'Engine oil 15W-40 (8 L)', 1, 96], ['part', 'Oil and fuel filters', 1, 88], ['labour', 'Diesel logbook service', 2.5, H]]
const wipers: Line = ['part', 'Wiper blades (pair)', 1, 39]
const alignment: Line = ['labour', 'Four-wheel alignment', 1, 99]
const frontBrakes = (): Line[] => [['part', 'Front brake pads (set)', 1, 89], ['part', 'Front brake rotors (pair)', 1, 176], ['part', 'Brake fluid DOT 4 (1 L)', 1, 24], ['labour', 'Replace pads and rotors, flush brake fluid', 2, H]]
const battery = (name = 'Battery N70ZZ 750 CCA', dollars = 245): Line[] => [['part', name, 1, dollars], ['labour', 'Battery test and replacement, charging system check', 0.5, H]]
const radiator = (): Line[] => [['part', 'Radiator (aftermarket)', 1, 320], ['part', 'Coolant (5 L)', 1, 39], ['part', 'Top radiator hose', 1, 46], ['labour', 'Replace radiator and hose, pressure test', 2, H]]

export const history: Visit[] = [
  // The run site's story: M-000001, $206.80, Jordan says yes to both lines by phone.
  { asset: 'corolla', title: 'Oil service', bay: 'Bay 1', tech: 'tom', day: -46, start: '08:00', hours: 1, stage: 'invoiced', lines: [['part', 'Engine oil 5W-30', 1, 68], ['labour', 'Oil service', 1, 120]], share: 'phone', authorise: 'phone', preparedBy: 'dana' },
  { asset: 'hiace1', title: 'Diesel logbook service 60,000 km', bay: 'Bay 2', tech: 'luis', day: -44, start: '08:30', hours: 2.5, stage: 'invoiced', lines: [...diesel(), wipers], decline: [3], share: 'email', authorise: 'email reply' },
  { asset: 'cx5', title: 'Logbook service 40,000 km', bay: 'Bay 3', tech: 'mia', day: -42, start: '09:00', hours: 2, stage: 'invoiced', lines: [...logbook(), ['part', 'Cabin air filter', 1, 42]], share: 'in person', authorise: 'in person' },
  { asset: 'navara', title: 'Front brakes grinding', bay: 'Bay 1', tech: 'tom', day: -41, start: '08:00', hours: 3, stage: 'invoiced', lines: frontBrakes(), share: 'phone', authorise: 'phone' },
  { asset: 'jazz', title: 'Battery warning light', bay: 'Bay 4', tech: 'ken', day: -39, start: '13:00', hours: 1, stage: 'invoiced', lines: battery('Battery NS40ZL 330 CCA', 189), share: 'in person', authorise: 'in person' },
  { asset: 'prado', title: 'Timing belt and water pump (150,000 km)', bay: 'Bay 1', tech: 'tom', day: -38, start: '08:00', hours: 6, stage: 'invoiced', preparedBy: 'oldagent', approvedBy: 'priya', lines: [['part', 'Timing belt kit with tensioner and idler', 1, 412], ['part', 'Water pump', 1, 188], ['part', 'Coolant (5 L)', 1, 39], ['labour', 'Replace timing belt and water pump', 5.5, H]], share: 'printed', authorise: 'signed' },
  // A diagnosis visit, then the repair it found booked as its own visit.
  { asset: 'golf', title: 'Check engine light, rough idle', bay: 'Bay 2', tech: 'luis', day: -36, start: '09:00', hours: 1, stage: 'invoiced', lines: [['labour', 'Diagnostic scan and road test', 1, H]], share: 'phone', authorise: 'phone' },
  { asset: 'golf', title: 'Replace ignition coil and spark plugs', bay: 'Bay 2', tech: 'luis', day: -35, start: '08:00', hours: 1.5, stage: 'invoiced', bookedAhead: 1, lines: [['part', 'Ignition coil (cylinder 3)', 1, 118], ['part', 'Iridium spark plugs (4)', 1, 96], ['labour', 'Replace coil and spark plugs', 1, H]], share: 'phone', authorise: 'phone' },
  { asset: 'i30', title: 'Two front tyres and alignment', bay: 'Bay 3', tech: 'mia', day: -35, start: '08:30', hours: 1.5, stage: 'invoiced', lines: [['part', 'Tyre 205/55R16 (each)', 2, 165], ['labour', 'Fit and balance tyres', 0.75, H], alignment], share: 'printed', authorise: 'in person' },
  { asset: 'hiace2', title: 'Diesel logbook service 60,000 km', bay: 'Bay 2', tech: 'luis', day: -33, start: '08:00', hours: 2.5, stage: 'invoiced', lines: diesel(), share: 'email', authorise: 'email reply' },
  { asset: 'lancer', title: 'Rear brakes squealing', bay: 'Bay 4', tech: 'ken', day: -32, start: '10:00', hours: 1.5, stage: 'invoiced', lines: [['part', 'Rear brake shoes (set)', 1, 72], ['labour', 'Replace rear shoes, adjust handbrake', 1.5, H]], work: [[0, 1], [1, 1.25]], share: 'phone', authorise: 'phone' },
  { asset: 'wildtrak', title: 'Logbook service 75,000 km', bay: 'Bay 1', tech: 'tom', day: -30, start: '08:00', hours: 2.5, stage: 'invoiced', preparedBy: 'oldagent', lines: [...diesel(), wipers], decline: [3], share: 'phone', authorise: 'phone' },
  { asset: 'accord', title: 'Overheating in traffic', bay: 'Bay 3', tech: 'mia', day: -29, start: '13:00', hours: 2.5, stage: 'invoiced', lines: radiator(), share: 'email', authorise: 'email reply' },
  { asset: 'swift', title: 'Pre-purchase inspection', bay: 'Bay 4', tech: 'ken', day: -27, start: '08:30', hours: 1, stage: 'invoiced', lines: [['labour', 'Pre-purchase inspection and report', 1, 165]], share: 'in person', authorise: 'in person' },
  { asset: 'commodore', title: 'Clutch slipping', bay: 'Bay 1', tech: 'tom', day: -26, start: '08:00', hours: 6.5, stage: 'invoiced', lines: [['part', 'Clutch kit (pressure plate, disc, bearing)', 1, 495], ['labour', 'Replace clutch', 6, H]], revise: [['part', 'Clutch kit (pressure plate, disc, bearing)', 1, 495], ['part', 'Machine flywheel', 1, 95], ['labour', 'Replace clutch', 6, H]], share: 'printed', authorise: 'signed' },
  { asset: 'outback', title: 'Logbook service 105,000 km', bay: 'Bay 2', tech: 'luis', day: -24, start: '09:00', hours: 3, stage: 'invoiced', lines: [...logbook(2.5), ['part', 'Iridium spark plugs (4)', 1, 104]], share: 'phone', authorise: 'phone' },
  { asset: 'dmax', title: 'Diesel logbook service 120,000 km', bay: 'Bay 3', tech: 'mia', day: -23, start: '08:00', hours: 2.5, stage: 'invoiced', lines: diesel(), share: 'email', authorise: 'email reply' },
  { asset: 'corolla', title: 'Front brake pads', bay: 'Bay 4', tech: 'ken', day: -21, start: '13:00', hours: 1.5, stage: 'invoiced', lines: [['part', 'Front brake pads (set)', 1, 89], ['labour', 'Replace front pads, machine rotors', 1.5, H]], share: 'phone', authorise: 'phone' },
  { asset: 'triton', title: 'Front end knock over bumps', bay: 'Bay 1', tech: 'tom', day: -20, start: '08:00', hours: 3.5, stage: 'invoiced', lines: [['part', 'Front lower control arm bushes (pair)', 1, 138], ['part', 'Front sway bar links (pair)', 1, 92], ['labour', 'Replace bushes and links', 2.5, H], alignment], decline: [3], share: 'phone', authorise: 'phone' },
  { asset: 'rav4', title: 'First service 15,000 km', bay: 'Bay 2', tech: 'luis', day: -18, start: '09:00', hours: 1, stage: 'invoiced', lines: [['part', 'Engine oil 0W-16 (4 L)', 1, 72], ['part', 'Oil filter', 1, 22], ['labour', 'Hybrid logbook service', 1, H]], share: 'in person', authorise: 'in person' },
  { asset: 'focus', title: 'Air-con not cold', bay: 'Bay 3', tech: 'mia', day: -17, start: '08:00', hours: 2, stage: 'invoiced', lines: [['labour', 'A/C diagnosis and leak test', 1, H], ['part', 'Refrigerant regas R134a', 1, 129], ['labour', 'Vacuum and regas', 0.5, H]], share: 'phone', authorise: 'phone' },
  { asset: 'zsev', title: 'Tyre puncture repair', bay: 'Bay 4', tech: 'ken', day: -15, start: '13:00', hours: 0.5, stage: 'invoiced', bookedAhead: 0, lines: [['labour', 'Puncture repair (plug and patch)', 1, 45]], share: 'in person', authorise: 'in person' },
  { asset: 'ranger-xl', title: 'Diesel logbook service 90,000 km', bay: 'Bay 1', tech: 'tom', day: -14, start: '08:00', hours: 2.5, stage: 'invoiced', lines: diesel(), share: 'email', authorise: 'email reply', preparedBy: 'agent',
    dispatch: { by: 'agent', day: -14, start: '08:00', hours: 2.5, bay: 'Bay 2', tech: 'luis', reason: 'The Bay 1 hoist is out for its annual inspection that morning. Bay 2 and Luis are free for the same slot.', approvedBy: 'priya' } },
  { asset: 'mazda3', title: 'Slow to start in the mornings', bay: 'Bay 4', tech: 'ken', day: -12, start: '09:00', hours: 1, stage: 'invoiced', lines: battery('Battery NS60 500 CCA', 205), share: 'phone', authorise: 'phone' },
  { asset: 'cerato', title: 'Logbook service 30,000 km', bay: 'Bay 2', tech: 'luis', day: -11, start: '08:30', hours: 2, stage: 'invoiced', lines: [...logbook(1.5), wipers], decline: [4], share: 'in person', authorise: 'in person', preparedBy: 'agent' },
  { asset: 'golf', title: 'Front struts leaking', bay: 'Bay 1', tech: 'tom', day: -9, start: '08:00', hours: 4, stage: 'invoiced', lines: [['part', 'Front struts (pair)', 1, 520], ['part', 'Strut top mounts (pair)', 1, 110], ['labour', 'Replace front struts', 3, H], alignment], share: 'printed', authorise: 'signed' },
  { asset: 'i30', title: 'Headlight out, wipers smearing', bay: 'Bay 4', tech: 'ken', day: -7, start: '13:00', hours: 0.5, stage: 'invoiced', lines: [['part', 'H7 headlight bulb', 2, 18], wipers, ['labour', 'Fit bulbs and wiper blades', 0.5, H]], share: 'in person', authorise: 'in person', preparedBy: 'agent' },
  { asset: 'hiace1', title: 'Brakes pulling left', bay: 'Bay 3', tech: 'mia', day: -6, start: '08:00', hours: 2.5, stage: 'invoiced', lines: frontBrakes(), share: 'email', authorise: 'email reply' },
  { asset: 'forester', title: 'Logbook service 140,000 km', bay: 'Bay 2', tech: 'luis', day: -4, start: '09:00', hours: 2, stage: 'invoiced', lines: logbook(), share: 'phone', authorise: 'phone' },
  { asset: 'jazz', title: 'Wheel alignment and tyre rotation', bay: 'Bay 4', tech: 'ken', day: -3, start: '08:00', hours: 1.5, stage: 'invoiced', lines: [alignment, ['labour', 'Rotate and balance tyres', 0.5, H]], share: 'phone', authorise: 'phone' },
  { asset: 'prado', title: 'Rear diff whine', bay: 'Bay 1', tech: 'tom', day: -2, start: '13:00', hours: 2, stage: 'invoiced', lines: [['labour', 'Inspect rear diff', 0.5, H], ['part', 'Diff oil 75W-90 (3 L)', 1, 66], ['labour', 'Drain and refill rear diff', 0.75, H]], share: 'phone', authorise: 'phone' },
]

export const current: Visit[] = [
  // In the bays now, with work recorded this morning.
  { asset: 'forester', title: 'Timing belt, water pump and drive belts', bay: 'Bay 1', tech: 'tom', day: 0, start: '07:30', hours: 6, stage: 'working', bookedAhead: 4, estimateAt: [-4, '11:40'], decidedAt: [-1, '09:10'], lines: [['part', 'Timing belt kit with tensioner and idler', 1, 389], ['part', 'Water pump', 1, 162], ['part', 'Drive belts (set)', 1, 74], ['part', 'Coolant (5 L)', 1, 39], ['labour', 'Timing belt, water pump and drive belts', 5.5, H]], share: 'phone', authorise: 'phone', work: [[0, 1], [1, 1], [4, 1.5]] },
  { asset: 'cx5', title: 'Front brake pads and rotors, brake fluid flush', bay: 'Bay 2', tech: 'luis', day: 0, start: '08:00', hours: 3.5, stage: 'working', lines: frontBrakes(), share: 'in person', authorise: 'phone', approvedBy: 'dana', work: [[0, 1], [1, 1]] },
  { asset: 'swift', title: 'Logbook service 60,000 km', bay: 'Bay 3', tech: 'mia', day: 0, start: '08:30', hours: 3.5, stage: 'working', preparedBy: 'agent', estimateAt: [-1, '15:10'], decidedAt: [0, '08:20'], lines: [...logbook(1.5), wipers], decline: [4], share: 'email', authorise: 'email reply', work: [[0, 1], [1, 1]] },
  // Waiting on parts: diagnosed yesterday, the clutch kit is on order. Recorded work keeps the job's bay and technician.
  { asset: 'focus', title: 'Air-con still not cold: compressor clutch kit on order', bay: 'Bay 4', tech: 'ken', day: -1, start: '13:00', hours: 2, stage: 'working', lines: [['labour', 'A/C diagnosis and leak test', 1, H], ['part', 'A/C compressor clutch kit', 1, 410], ['part', 'Refrigerant regas R134a', 1, 129], ['labour', 'Fit clutch kit and regas', 2, H]], share: 'phone', authorise: 'phone', work: [[0, 1]] },
  // Ready for pickup.
  { asset: 'lancer', title: 'Clicking on full lock, CV boot split', bay: 'Bay 2', tech: 'luis', day: -1, start: '13:00', hours: 3, stage: 'completed', lines: [['part', 'Front CV shaft (driver side)', 1, 285], ['labour', 'Replace CV shaft', 1.5, H]], share: 'phone', authorise: 'phone', invoice: 'draft', invoicedBy: 'agent' },
  { asset: 'zsev', title: '12 V battery replacement', bay: 'Bay 4', tech: 'ken', day: 0, start: '07:30', hours: 1, stage: 'completed', estimateAt: [0, '07:40'], decidedAt: [0, '07:58'], lines: battery('12 V auxiliary battery', 229), share: 'in person', authorise: 'signed', invoice: 'approved' },
  // Waiting for the customer's decision.
  { asset: 'triton', title: 'Steering wheel shake at 90 km/h', bay: 'Bay 4', tech: 'ken', day: 0, start: '09:00', hours: 2, stage: 'sent', estimateAt: [0, '09:25'], approvedBy: 'priya', lines: [['part', 'Front tyre 265/65R17 (each)', 2, 235], ['labour', 'Fit and balance tyres', 0.75, H], alignment], share: 'phone' },
  { asset: 'commodore', title: 'Transmission service', bay: 'Bay 2', tech: 'luis', day: 0, start: '13:00', hours: 3, stage: 'sent', estimateAt: [-1, '16:05'], reviseAt: [0, '09:05'], lines: [['part', 'Transmission fluid (8 L)', 1, 176], ['part', 'Transmission filter kit', 1, 98], ['labour', 'Transmission service', 1.5, H]], revise: [['part', 'Transmission fluid (8 L)', 1, 176], ['part', 'Transmission filter kit', 1, 98], ['labour', 'Transmission service', 1.5, H], ['part', 'Engine mount (driver side)', 1, 148], ['labour', 'Replace engine mount', 1.2, H]], share: 'printed' },
  // Estimates waiting for a person to approve.
  { asset: 'rav4', title: 'Logbook service 30,000 km', bay: 'Bay 1', tech: 'tom', day: 1, start: '08:00', hours: 2, stage: 'draft', preparedBy: 'agent', estimateAt: [0, '08:10'], lines: [['part', 'Engine oil 0W-16 (4 L)', 1, 72], ['part', 'Oil filter', 1, 22], ['part', 'Cabin air filter', 1, 42], ['labour', 'Hybrid logbook service', 1.5, H]] },
  { asset: 'accord', title: 'Rear brakes, handbrake not holding', bay: 'Bay 3', tech: 'mia', day: 1, start: '10:30', hours: 2, stage: 'draft', estimateAt: [0, '09:40'], lines: [['part', 'Rear brake pads (set)', 1, 79], ['labour', 'Replace rear pads, adjust handbrake', 1.5, H]] },
  // Authorised ahead of the visit.
  { asset: 'outback', title: 'Replace front struts (quoted at last service)', bay: 'Bay 2', tech: 'luis', day: 1, start: '08:00', hours: 4, stage: 'authorised', bookedAhead: 3, estimateAt: [-3, '10:20'], decidedAt: [-1, '11:05'], lines: [['part', 'Front struts (pair)', 1, 548], ['part', 'Strut top mounts (pair)', 1, 118], ['labour', 'Replace front struts', 3, H], alignment], share: 'email', authorise: 'email reply' },
  // Waiting on parts: the radiator delivery slipped.
  { asset: 'hiace2', title: 'Coolant leak, radiator end tank cracked', bay: 'Bay 3', tech: 'mia', day: 1, start: '13:00', hours: 2.5, stage: 'authorised', estimateAt: [-2, '14:20'], decidedAt: [-1, '09:30'], lines: radiator(), share: 'email', authorise: 'email reply',
    dispatch: { by: 'agent', day: 3, start: '08:00', hours: 2.5, bay: 'Bay 3', tech: 'mia', reason: 'The supplier moved the radiator delivery back two days. Rebook the fit for when it lands, Bay 3 with Mia.' } },
  // Booked in, not yet looked at.
  { asset: 'i30', title: 'Check engine light on', bay: 'Bay 1', tech: 'tom', day: 1, start: '13:00', hours: 1.5, stage: 'booked', bookedAhead: 1 },
  { asset: 'dmax', title: 'Safety certificate (roadworthy) inspection', bay: 'Bay 4', tech: 'ken', day: 1, start: '08:30', hours: 1, stage: 'booked' },
  { asset: 'corolla', title: 'Logbook service 60,000 km', bay: 'Bay 1', tech: 'tom', day: 2, start: '08:00', hours: 2, stage: 'booked' },
  { asset: 'navara', title: 'Clunk when changing gears', bay: 'Bay 2', tech: 'luis', day: 2, start: '13:00', hours: 2, stage: 'booked', bookedAhead: 2 },
  { asset: 'cerato', title: 'Tyre rotation and alignment', bay: 'Bay 4', tech: 'ken', day: 3, start: '13:00', hours: 1, stage: 'booked' },
  { asset: 'hiace1', title: 'Diesel logbook service 75,000 km', bay: 'Bay 2', tech: 'luis', day: 4, start: '08:00', hours: 2.5, stage: 'booked', bookedAhead: 6 },
  { asset: 'wildtrak', title: 'Pre-trip check before a Cape York trip', bay: 'Bay 1', tech: 'tom', day: 5, start: '08:00', hours: 2, stage: 'booked', bookedAhead: 7 },
]
