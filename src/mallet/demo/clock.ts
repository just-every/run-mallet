// The sample workshop's clock: Brisbane (AEST, UTC+10, no daylight saving), open
// Monday to Friday. Every demo time is relative to the visitor's `now`.
const OFFSET = 10 * 3600000, DAY = 86400000

export type Clock = { now: Date; anchor: number; at(day: number, time: string): string; iso(ms: number): string; ms(day: number, time: string): number }

const local = (ms: number) => new Date(ms + OFFSET)
const weekday = (ms: number) => { const d = local(ms).getUTCDay(); return d >= 1 && d <= 5 }
const midnight = (ms: number) => { const d = local(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - OFFSET }
const minutes = (ms: number) => { const d = local(ms); return d.getUTCHours() * 60 + d.getUTCMinutes() }
function previousWorkday(day: number) { do day -= DAY; while (!weekday(day)); return day }

/**
 * The anchor is the latest workshop moment not after `now`: `now` itself on a
 * weekday from 10:00 to 17:30, else 16:45 on the last weekday. "Today" (day 0)
 * is the anchor's day; day n is n workdays later (negative: earlier).
 */
export function workshopClock(now: Date): Clock {
  const t = now.getTime(), m = minutes(t)
  let anchor = t
  if (!weekday(t) || m < 600) anchor = previousWorkday(midnight(t)) + (16 * 60 + 45) * 60000
  else if (m > 17 * 60 + 30) anchor = midnight(t) + (16 * 60 + 45) * 60000
  const today = midnight(anchor)
  const dayStart = (n: number) => {
    let day = today
    for (let i = 0; i < Math.abs(n); i++) do day += Math.sign(n) * DAY; while (!weekday(day))
    return day
  }
  const ms = (day: number, time: string) => { const [h, min] = time.split(':').map(Number); return dayStart(day) + (h * 60 + min) * 60000 }
  const iso = (value: number) => new Date(Math.min(value, t)).toISOString()
  return { now, anchor, ms, iso, at: (day, time) => new Date(ms(day, time)).toISOString() }
}
