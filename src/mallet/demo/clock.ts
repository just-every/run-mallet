// The sample shop's clock: Columbus, Ohio (America/New_York, with daylight
// saving), open Monday to Friday. Every demo time is relative to the visitor's `now`.
const ZONE = 'America/New_York', DAY = 86400000
const zoned = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export type Clock = { now: Date; anchor: number; at(day: number, time: string): string; iso(ms: number): string; ms(day: number, time: string): number }

// The shop's wall clock for an instant, as a UTC-based Date whose UTC fields read as local time.
const local = (ms: number) => {
  const p = Object.fromEntries(zoned.formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second, new Date(ms).getUTCMilliseconds()))
}
const offset = (ms: number) => local(ms).getTime() - ms
const weekday = (ms: number) => { const d = local(ms).getUTCDay(); return d >= 1 && d <= 5 }
const midnight = (ms: number) => { const d = local(ms), wall = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return wall - offset(wall - offset(ms)) }
const minutes = (ms: number) => { const d = local(ms); return d.getUTCHours() * 60 + d.getUTCMinutes() }
function previousWorkday(day: number) { do day = midnight(day - DAY / 2); while (!weekday(day + DAY / 2)); return day }

/** "9:24 am" on the shop's wall clock. */
export function shopTime(ms: number) { const d = local(ms), h = d.getUTCHours(); return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}` }
/** "Tuesday" on the shop's calendar. */
export function shopWeekday(ms: number) { return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][local(ms).getUTCDay()] }

/**
 * The anchor is the latest shop moment not after `now`: `now` itself on a
 * weekday from 10:00 to 17:30, else 16:45 on the last weekday. "Today" (day 0)
 * is the anchor's day; day n is n workdays later (negative: earlier).
 */
export function workshopClock(now: Date): Clock {
  const t = now.getTime(), m = minutes(t)
  const at4 = (day: number) => { const wall = local(day).getTime() + (16 * 60 + 45) * 60000; return wall - offset(day) }
  let anchor = t
  if (!weekday(t) || m < 600) anchor = at4(previousWorkday(midnight(t)))
  else if (m > 17 * 60 + 30) anchor = at4(midnight(t))
  const today = midnight(anchor)
  const dayStart = (n: number) => {
    let day = today
    for (let i = 0; i < Math.abs(n); i++) do day = midnight(day + Math.sign(n) * DAY + DAY / 2); while (!weekday(day + DAY / 2))
    return day
  }
  const ms = (day: number, time: string) => { const [h, min] = time.split(':').map(Number), start = dayStart(day), wall = local(start).getTime() + (h * 60 + min) * 60000; return wall - offset(start + (h * 60 + min) * 60000) }
  const iso = (value: number) => new Date(Math.min(value, t)).toISOString()
  return { now, anchor, ms, iso, at: (day, time) => new Date(ms(day, time)).toISOString() }
}
