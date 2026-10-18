// The sample shop's visits: ten weeks of collected history, today's bays and
// the coming week. Days count workdays from today (negative: earlier).
import type { Who } from './people'

export type Line = [kind: 'part' | 'labor', description: string, quantity: number, dollars: number]
export type Stage = 'booked' | 'draft' | 'sent' | 'authorised' | 'working' | 'completed' | 'invoiced'
type Tech = 'andre' | 'luis' | 'mei' | 'jake' | 'chris'
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
  /** A dispatch plan; `{next}` in its reason reads as the weekday of the plan's day. */
  dispatch?: { by: Who; day: number; start: string; hours: number; bay: string; tech: Tech; reason: string; approvedBy?: Who }
}

const H = 135 // labor, USD per hour before tax
const oil = (quarts: string, dollars: number): Line[] => [['part', `Synthetic oil 0W-20 (${quarts})`, 1, dollars], ['part', 'Oil filter', 1, 12.95]]
const mileage = (hours = 1.5): Line[] => [...oil('5 qt', 42.5), ['part', 'Engine air filter', 1, 28.9], ['labor', 'Scheduled maintenance and multi-point inspection', hours, H]]
const fleet = (): Line[] => [['part', 'Motorcraft 5W-30 (7 qt)', 1, 61.6], ['part', 'Oil and fuel filters', 1, 74.2], ['labor', 'Fleet service and DOT inspection', 2, H]]
const wipers: Line = ['part', 'Wiper blades (pair)', 1, 34.9]
const alignment: Line = ['labor', 'Four-wheel alignment', 1, 119]
const frontBrakes = (): Line[] => [['part', 'Front brake pads (set)', 1, 58.45], ['part', 'Front brake rotors', 2, 41.9], ['part', 'DOT 3 brake fluid', 1, 19.95], ['labor', 'Replace front pads and rotors, flush brake fluid', 2.4, H]]
const battery = (name = 'Battery H6 760 CCA', dollars = 219): Line[] => [['part', name, 1, dollars], ['labor', 'Battery test and replacement, charging system check', 0.5, H]]
const radiator = (): Line[] => [['part', 'Radiator (aftermarket)', 1, 289], ['part', 'Coolant (1 gal)', 1, 27.5], ['part', 'Upper radiator hose', 1, 41], ['labor', 'Replace radiator and hose, pressure test', 2, H]]

export const history: Visit[] = [
  { asset: 'corolla', title: 'Oil change', bay: 'Bay 1', tech: 'andre', day: -46, start: '08:00', hours: 1, stage: 'invoiced', lines: [['part', 'Synthetic oil 0W-20 (5 qt)', 1, 42.5], ['labor', 'Oil change and tire pressure check', 0.6, H]], share: 'phone', authorise: 'phone', preparedBy: 'kayla' },
  { asset: 'van7', title: 'Fleet service, 60,000 mi', bay: 'Bay 2', tech: 'mei', day: -44, start: '08:30', hours: 2.5, stage: 'invoiced', lines: [...fleet(), wipers], decline: [3], share: 'email', authorise: 'email reply' },
  { asset: 'cx5', title: '40,000-mile service', bay: 'Bay 3', tech: 'luis', day: -42, start: '09:00', hours: 2, stage: 'invoiced', lines: [...mileage(), ['part', 'Cabin air filter', 1, 64.8]], share: 'in person', authorise: 'in person' },
  { asset: 'silverado', title: 'Front brakes grinding', bay: 'Bay 1', tech: 'andre', day: -41, start: '08:00', hours: 3, stage: 'invoiced', lines: frontBrakes(), share: 'phone', authorise: 'phone' },
  { asset: 'civic', title: 'Battery light on', bay: 'Bay 4', tech: 'jake', day: -39, start: '13:00', hours: 1, stage: 'invoiced', lines: battery('Battery 51R 500 CCA', 169), share: 'in person', authorise: 'in person' },
  { asset: 'odyssey', title: 'Spark plugs and coil packs, 100,000 mi', bay: 'Bay 1', tech: 'andre', day: -38, start: '08:00', hours: 4, stage: 'invoiced', preparedBy: 'oldagent', approvedBy: 'ben', lines: [['part', 'Iridium spark plugs (6)', 1, 89.4], ['part', 'Ignition coil (cylinder 4)', 1, 96], ['labor', 'Replace spark plugs and coil', 2.2, H]], share: 'printed', authorise: 'signed' },
  // A diagnosis visit, then the repair it found booked as its own visit.
  { asset: 'golf', title: 'Check engine light, rough idle', bay: 'Bay 2', tech: 'mei', day: -36, start: '09:00', hours: 1, stage: 'invoiced', lines: [['labor', 'Diagnostic scan and road test', 1, H]], share: 'phone', authorise: 'phone' },
  { asset: 'golf', title: 'Replace ignition coil and spark plugs', bay: 'Bay 2', tech: 'mei', day: -35, start: '08:00', hours: 1.5, stage: 'invoiced', bookedAhead: 1, lines: [['part', 'Ignition coil (cylinder 3)', 1, 104], ['part', 'Iridium spark plugs (4)', 1, 72], ['labor', 'Replace coil and spark plugs', 1, H]], share: 'phone', authorise: 'phone' },
  { asset: 'fusion', title: 'Two front tires and alignment', bay: 'Bay 6', tech: 'chris', day: -35, start: '08:30', hours: 1.5, stage: 'invoiced', lines: [['part', 'Tire 235/50R17 (each)', 2, 142], ['labor', 'Mount and balance tires', 0.75, H], alignment], share: 'printed', authorise: 'in person' },
  { asset: 'van8', title: 'Fleet service, 60,000 mi', bay: 'Bay 2', tech: 'mei', day: -33, start: '08:00', hours: 2.5, stage: 'invoiced', lines: fleet(), share: 'email', authorise: 'email reply' },
  { asset: 'accord', title: 'Rear brakes squealing', bay: 'Bay 4', tech: 'jake', day: -32, start: '10:00', hours: 1.5, stage: 'invoiced', lines: [['part', 'Rear brake pads (set)', 1, 49.9], ['labor', 'Replace rear pads, adjust parking brake', 1.5, H]], work: [[0, 1], [1, 1.25]], share: 'phone', authorise: 'phone' },
  { asset: 'f150', title: 'Fleet service, 75,000 mi', bay: 'Bay 1', tech: 'andre', day: -30, start: '08:00', hours: 2.5, stage: 'invoiced', preparedBy: 'oldagent', lines: [...fleet(), wipers], decline: [3], share: 'phone', authorise: 'phone' },
  { asset: 'malibu', title: 'Overheating in traffic', bay: 'Bay 3', tech: 'luis', day: -29, start: '13:00', hours: 2.5, stage: 'invoiced', lines: radiator(), share: 'email', authorise: 'email reply' },
  { asset: 'cherokee', title: 'Pre-purchase inspection', bay: 'Bay 4', tech: 'jake', day: -27, start: '08:30', hours: 1, stage: 'invoiced', lines: [['labor', 'Pre-purchase inspection and report', 1, 149]], share: 'in person', authorise: 'in person' },
  { asset: 'malibu', title: 'Transmission slipping', bay: 'Bay 1', tech: 'andre', day: -26, start: '08:00', hours: 3, stage: 'invoiced', lines: [['part', 'ATF Dexron VI (6 qt)', 1, 59.4], ['labor', 'Transmission fluid exchange and road test', 1.5, H]], revise: [['part', 'ATF Dexron VI (6 qt)', 1, 59.4], ['part', 'Transmission filter kit', 1, 48], ['labor', 'Transmission fluid exchange and road test', 1.5, H]], share: 'printed', authorise: 'signed' },
  { asset: 'outback', title: '105,000-mile service', bay: 'Bay 2', tech: 'mei', day: -24, start: '09:00', hours: 3, stage: 'invoiced', lines: [...mileage(2.5), ['part', 'Iridium spark plugs (4)', 1, 78]], share: 'phone', authorise: 'phone' },
  { asset: 'colorado', title: 'Fleet service, 120,000 mi', bay: 'Bay 3', tech: 'luis', day: -23, start: '08:00', hours: 2.5, stage: 'invoiced', lines: fleet(), share: 'email', authorise: 'email reply' },
  { asset: 'corolla', title: 'Front brake pads', bay: 'Bay 4', tech: 'jake', day: -21, start: '13:00', hours: 1.5, stage: 'invoiced', lines: [['part', 'Front brake pads (set)', 1, 58.45], ['labor', 'Replace front pads, resurface rotors', 1.5, H]], share: 'phone', authorise: 'phone' },
  { asset: 'silverado', title: 'Front end clunk over bumps', bay: 'Bay 1', tech: 'andre', day: -20, start: '08:00', hours: 3.5, stage: 'invoiced', lines: [['part', 'Front lower control arms (pair)', 1, 248], ['part', 'Front sway bar links (pair)', 1, 76], ['labor', 'Replace control arms and links', 2.5, H], alignment], decline: [3], share: 'phone', authorise: 'phone' },
  { asset: 'rav4', title: '15,000-mile service', bay: 'Bay 2', tech: 'mei', day: -18, start: '09:00', hours: 1, stage: 'invoiced', lines: [...oil('5 qt', 42.5), ['labor', 'Scheduled maintenance and tire rotation', 1, H]], share: 'in person', authorise: 'in person' },
  { asset: 'equinox', title: 'A/C not cold', bay: 'Bay 3', tech: 'luis', day: -17, start: '08:00', hours: 2, stage: 'invoiced', lines: [['labor', 'A/C diagnosis and leak test', 1, H], ['part', 'Refrigerant R-134a recharge', 1, 89], ['labor', 'Evacuate and recharge', 0.5, H]], share: 'phone', authorise: 'phone' },
  { asset: 'model3', title: 'Flat tire repair', bay: 'Bay 4', tech: 'jake', day: -15, start: '13:00', hours: 0.5, stage: 'invoiced', bookedAhead: 0, lines: [['labor', 'Flat repair (plug and patch)', 1, 39]], share: 'in person', authorise: 'in person' },
  { asset: 'van8', title: 'Fleet service, 90,000 mi', bay: 'Bay 1', tech: 'andre', day: -14, start: '08:00', hours: 2.5, stage: 'invoiced', lines: fleet(), share: 'email', authorise: 'email reply', preparedBy: 'agent',
    dispatch: { by: 'agent', day: -14, start: '08:00', hours: 2.5, bay: 'Bay 2', tech: 'mei', reason: 'The Bay 1 lift is out for its annual inspection that morning. Bay 2 and Mei are free for the same slot.', approvedBy: 'ben' } },
  { asset: 'accord', title: 'Slow to start in the mornings', bay: 'Bay 4', tech: 'jake', day: -12, start: '09:00', hours: 1, stage: 'invoiced', lines: battery('Battery 51R 500 CCA', 169), share: 'phone', authorise: 'phone' },
  { asset: 'elantra', title: '30,000-mile service', bay: 'Bay 2', tech: 'mei', day: -11, start: '08:30', hours: 2, stage: 'invoiced', lines: [...mileage(1.2), wipers], decline: [4], share: 'in person', authorise: 'in person', preparedBy: 'agent' },
  { asset: 'golf', title: 'Front struts leaking', bay: 'Bay 1', tech: 'andre', day: -9, start: '08:00', hours: 4, stage: 'invoiced', lines: [['part', 'Front struts (pair)', 1, 412], ['part', 'Strut mounts (pair)', 1, 96], ['labor', 'Replace front struts', 3, H], alignment], share: 'printed', authorise: 'signed' },
  { asset: 'fusion', title: 'Headlight out, wipers streaking', bay: 'Bay 4', tech: 'jake', day: -7, start: '13:00', hours: 0.5, stage: 'invoiced', lines: [['part', 'H11 headlight bulb', 2, 16.5], wipers, ['labor', 'Replace bulbs and wiper blades', 0.5, H]], share: 'in person', authorise: 'in person', preparedBy: 'agent' },
  { asset: 'van7', title: 'Brakes pulling left', bay: 'Bay 3', tech: 'luis', day: -6, start: '08:00', hours: 2.5, stage: 'invoiced', lines: frontBrakes(), share: 'email', authorise: 'email reply' },
  { asset: 'outback', title: 'Oil change and tire rotation', bay: 'Bay 2', tech: 'mei', day: -4, start: '09:00', hours: 1, stage: 'invoiced', lines: [...oil('5 qt', 42.5), ['labor', 'Oil change and tire rotation', 0.8, H]], share: 'phone', authorise: 'phone' },
  { asset: 'civic', title: 'Alignment and tire rotation', bay: 'Bay 6', tech: 'chris', day: -3, start: '08:00', hours: 1.5, stage: 'invoiced', lines: [alignment, ['labor', 'Rotate and balance tires', 0.5, H]], share: 'phone', authorise: 'phone' },
  { asset: 'odyssey', title: 'Rear differential whine', bay: 'Bay 1', tech: 'andre', day: -2, start: '13:00', hours: 2, stage: 'invoiced', lines: [['labor', 'Inspect rear differential', 0.5, H], ['part', 'Gear oil 75W-90 (3 qt)', 1, 44], ['labor', 'Drain and refill differential', 0.75, H]], share: 'phone', authorise: 'phone' },
]

export const current: Visit[] = [
  // In the bays now, with work recorded this morning.
  { asset: 'f150', title: 'Water pump and serpentine belt', bay: 'Bay 1', tech: 'andre', day: 0, start: '07:30', hours: 6, stage: 'working', bookedAhead: 4, estimateAt: [-4, '11:40'], decidedAt: [-1, '09:10'], lines: [['part', 'Water pump', 1, 168], ['part', 'Serpentine belt', 1, 54], ['part', 'Coolant (1 gal)', 1, 27.5], ['labor', 'Replace water pump and belt, pressure test', 3.6, H]], share: 'phone', authorise: 'phone', work: [[0, 1], [1, 1], [3, 1.9]] },
  { asset: 'cx5', title: 'Brake fluid service', bay: 'Bay 2', tech: 'mei', day: 0, start: '08:00', hours: 3.5, stage: 'working', lines: [['part', 'DOT 3 brake fluid', 1, 19.95], ['labor', 'Brake fluid flush and bleed', 0.8, H]], share: 'in person', authorise: 'phone', approvedBy: 'kayla', work: [[0, 1], [1, 0.5]] },
  { asset: 'explorer', title: '60,000-mile service', bay: 'Bay 3', tech: 'luis', day: 0, start: '08:00', hours: 5, stage: 'working', preparedBy: 'agent', estimateAt: [-1, '15:10'], decidedAt: [0, '07:50'], lines: [...mileage(2.4), wipers], decline: [4], share: 'email', authorise: 'email reply', work: [[0, 1], [1, 1], [3, 1.1]] },
  // Diagnosed yesterday; the compressor clutch is on order. Recorded work keeps the job's bay and technician.
  { asset: 'equinox', title: 'A/C diagnosis: compressor clutch on order', bay: 'Bay 4', tech: 'jake', day: -1, start: '13:00', hours: 2, stage: 'working', lines: [['labor', 'A/C diagnosis and leak test', 1, H], ['part', 'A/C compressor clutch kit', 1, 365], ['part', 'Refrigerant R-134a recharge', 1, 89], ['labor', 'Install clutch kit and recharge', 2, H]], share: 'phone', authorise: 'phone', work: [[0, 1]] },
  // Ready for pickup.
  { asset: 'telluride', title: 'Clicking on full lock, CV axle', bay: 'Bay 2', tech: 'mei', day: -1, start: '13:00', hours: 3, stage: 'completed', lines: [['part', 'Front CV axle (driver side)', 1, 248], ['labor', 'Replace CV axle', 1.5, H]], share: 'phone', authorise: 'phone', invoice: 'draft', invoicedBy: 'agent' },
  { asset: 'model3', title: '12 V battery replacement', bay: 'Bay 5', tech: 'chris', day: 0, start: '07:30', hours: 1, stage: 'completed', estimateAt: [0, '07:40'], decidedAt: [0, '07:58'], lines: battery('12 V low-voltage battery', 189), share: 'in person', authorise: 'signed', invoice: 'approved' },
  { asset: 'camry', title: 'Oil change and filter', bay: 'Bay 4', tech: 'jake', day: 0, start: '07:30', hours: 1, stage: 'completed', estimateAt: [0, '07:35'], decidedAt: [0, '07:45'], lines: [...oil('5 qt', 42.5), ['labor', 'Oil change and multi-point inspection', 0.6, H]], share: 'in person', authorise: 'in person' },
  // Waiting for the customer's decision.
  { asset: 'silverado', title: 'Steering wheel shake at 65 mph', bay: 'Bay 5', tech: 'chris', day: 0, start: '09:00', hours: 2, stage: 'sent', estimateAt: [0, '09:25'], approvedBy: 'ben', lines: [['part', 'Tire 265/70R17 (each)', 2, 189], ['labor', 'Mount and balance tires', 0.75, H], alignment], share: 'phone' },
  { asset: 'escape', title: 'Coolant leak', bay: 'Bay 2', tech: 'mei', day: 0, start: '13:00', hours: 3, stage: 'sent', estimateAt: [-1, '16:05'], reviseAt: [0, '08:50'], lines: [['part', 'Coolant reservoir', 1, 64], ['part', 'Coolant (1 gal)', 1, 27.5], ['labor', 'Replace reservoir, pressure test', 1.2, H]], revise: [['part', 'Coolant reservoir', 1, 64], ['part', 'Coolant (1 gal)', 1, 27.5], ['labor', 'Replace reservoir, pressure test', 1.2, H], ['part', 'Upper radiator hose', 1, 41], ['labor', 'Replace upper hose', 0.6, H]], share: 'email' },
  // Estimates waiting for a person to approve.
  { asset: 'rav4', title: '45,000-mile service', bay: 'Bay 1', tech: 'andre', day: 1, start: '08:00', hours: 2, stage: 'draft', preparedBy: 'agent', estimateAt: [0, '08:10'], lines: [...oil('5 qt', 42.5), ['part', 'Cabin air filter', 1, 64.8], ['labor', 'Scheduled maintenance and multi-point inspection', 1.5, H]] },
  { asset: 'bmw', title: 'Rear brakes squealing', bay: 'Bay 4', tech: 'jake', day: 1, start: '10:30', hours: 2, stage: 'draft', estimateAt: [0, '09:40'], lines: [['part', 'Rear brake pads (set)', 1, 112], ['part', 'Rear pad wear sensor', 1, 38], ['labor', 'Replace rear pads and sensor', 1.4, H]] },
  // Approved this morning; Worldpac backordered the pads, so the advisor drafted a move for a person to decide.
  { asset: 'crv', title: 'Front brakes: pads and rotors, brake fluid flush', bay: 'Bay 3', tech: 'luis', day: 0, start: '13:40', hours: 3 + 1 / 3, stage: 'authorised', bookedAhead: 1, preparedBy: 'agent', approvedBy: 'kayla', estimateAt: [0, '09:05'], decidedAt: [0, '09:24'], lines: [...frontBrakes(), ['part', 'Cabin air filter', 1, 64.8]], decline: [4], share: 'phone', authorise: 'phone',
    dispatch: { by: 'agent', day: 1, start: '10:30', hours: 2.5, bay: 'Bay 3', tech: 'luis', reason: 'Worldpac backordered the front pads to {next} 10:00 am, so today’s 5:00 pm promise cannot hold. Move the brake job to Bay 3 with Luis on {next} at 10:30 am, after the pads arrive.' } },
  // Authorized ahead of the visit.
  { asset: 'odyssey', title: 'Timing belt and water pump (declined at 101,200 mi)', bay: 'Bay 2', tech: 'mei', day: 1, start: '08:00', hours: 4, stage: 'authorised', bookedAhead: 3, estimateAt: [-3, '10:20'], decidedAt: [-1, '11:05'], lines: [['part', 'Timing belt kit with tensioner and idler', 1, 268], ['part', 'Water pump', 1, 142], ['labor', 'Replace timing belt and water pump', 2.8, H]], share: 'email', authorise: 'email reply' },
  // Booked in, not yet looked at.
  { asset: 'civic', title: 'Four-wheel alignment', bay: 'Bay 6', tech: 'chris', day: 0, start: '13:00', hours: 1, stage: 'booked', bookedAhead: 1 },
  { asset: 'elantra', title: 'Check engine light on', bay: 'Bay 1', tech: 'andre', day: 1, start: '13:00', hours: 1.5, stage: 'booked', bookedAhead: 1 },
  { asset: 'cherokee', title: 'Noise from front end', bay: 'Bay 5', tech: 'chris', day: 1, start: '08:30', hours: 1, stage: 'booked' },
  { asset: 'corolla', title: '60,000-mile service', bay: 'Bay 1', tech: 'andre', day: 2, start: '08:00', hours: 2, stage: 'booked' },
  { asset: 'accord', title: 'Parking brake not holding', bay: 'Bay 3', tech: 'luis', day: 2, start: '13:00', hours: 2, stage: 'booked', bookedAhead: 2 },
  { asset: 'colorado', title: 'Tire rotation and alignment', bay: 'Bay 6', tech: 'jake', day: 3, start: '13:00', hours: 1, stage: 'booked' },
  { asset: 'van7', title: 'Fleet service, 75,000 mi', bay: 'Bay 2', tech: 'mei', day: 4, start: '08:00', hours: 2.5, stage: 'booked', bookedAhead: 6 },
  { asset: 'malibu', title: 'Road trip check before a drive to Florida', bay: 'Bay 1', tech: 'andre', day: 5, start: '08:00', hours: 2, stage: 'booked', bookedAhead: 7 },
]
