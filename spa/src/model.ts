import type { Bootstrap, Occurrence, PlannerItem } from './types'

export function safeTimeZone(value?: string | null) {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Zagreb'
  try {
    if (!value) return fallback
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    return fallback
  }
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

export function zonedParts(value: string | Date, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  })
  const raw = Object.fromEntries(formatter.formatToParts(new Date(value)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]))
  return { year: raw.year, month: raw.month, day: raw.day, hour: raw.hour, minute: raw.minute, second: raw.second }
}

function utcMs(p: Parts) { return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) }

export function zonedToUtc(parts: Parts, timeZone: string) {
  let guess = new Date(utcMs(parts))
  for (let i = 0; i < 4; i += 1) {
    const actual = zonedParts(guess, timeZone)
    const delta = utcMs(parts) - utcMs(actual)
    if (!delta) break
    guess = new Date(guess.getTime() + delta)
  }
  return guess
}

export function dateKey(value: string | Date, timeZone: string) {
  const p = zonedParts(value, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function todayKey(timeZone: string) { return dateKey(new Date(), timeZone) }

export function keyToDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

export function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number)
  const x = new Date(Date.UTC(y, m - 1, d + days))
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`
}

export function dayStart(key: string, timeZone: string) {
  const [year, month, day] = key.split('-').map(Number)
  return zonedToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone)
}

export function dayEnd(key: string, timeZone: string) {
  return new Date(dayStart(shiftKey(key, 1), timeZone).getTime() - 1)
}

function daysInMonth(year: number, month: number) { return new Date(Date.UTC(year, month, 0)).getUTCDate() }

function addLocal(parts: Parts, repeat: PlannerItem['repeatType'], interval: number, n: number): Parts {
  const step = Math.max(1, interval || 1) * n
  if (repeat === 'DAILY' || repeat === 'WEEKLY') {
    const days = repeat === 'DAILY' ? step : step * 7
    const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second))
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: parts.hour, minute: parts.minute, second: parts.second }
  }
  if (repeat === 'MONTHLY') {
    const rawMonth = parts.month - 1 + step
    const year = parts.year + Math.floor(rawMonth / 12)
    const monthIndex = ((rawMonth % 12) + 12) % 12
    const month = monthIndex + 1
    return { year, month, day: Math.min(parts.day, daysInMonth(year, month)), hour: parts.hour, minute: parts.minute, second: parts.second }
  }
  if (repeat === 'YEARLY') {
    const year = parts.year + step
    return { year, month: parts.month, day: Math.min(parts.day, daysInMonth(year, parts.month)), hour: parts.hour, minute: parts.minute, second: parts.second }
  }
  return parts
}

export function occurrencesFor(item: PlannerItem, from: Date, to: Date, timeZone: string): Occurrence[] {
  if (item.isInbox) return []
  const raw = item.startAt || item.dueAt
  if (!raw) return []
  const base = new Date(raw)
  const duration = item.startAt && item.endAt ? Math.max(0, new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) : 0
  const make = (at: Date): Occurrence => {
    const state = item.occurrenceStates?.find(x => new Date(x.occurrenceAt).getTime() === at.getTime())
    return {
      item,
      occurrenceAt: at.toISOString(),
      occurrenceEndAt: duration ? new Date(at.getTime() + duration).toISOString() : null,
      completedAt: item.repeatType === 'NONE' ? item.completedAt || null : state?.completedAt || null
    }
  }

  if (item.repeatType === 'NONE') return base >= from && base <= to ? [make(base)] : []

  const results: Occurrence[] = []
  const baseParts = zonedParts(base, timeZone)
  for (let n = 0; n < 5000; n += 1) {
    const candidate = zonedToUtc(addLocal(baseParts, item.repeatType, item.repeatInterval || 1, n), timeZone)
    if (item.repeatUntil && candidate > new Date(item.repeatUntil)) break
    if (candidate > to) break
    if (candidate >= from) results.push(make(candidate))
  }
  return results
}

export function occurrencesBetween(boot: Bootstrap, from: Date, to: Date, timeZone: string) {
  return boot.items.flatMap(item => occurrencesFor(item, from, to, timeZone)).sort((a, b) => new Date(a.occurrenceAt).getTime() - new Date(b.occurrenceAt).getTime())
}

export function monthGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)
  const weekday = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - weekday)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function isoForLocal(key: string, time: string, timeZone: string) {
  const [year, month, day] = key.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return zonedToUtc({ year, month, day, hour: hour || 0, minute: minute || 0, second: 0 }, timeZone).toISOString()
}

export function formatTime(iso: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function reflectionKey(value: string) { return String(value).slice(0, 10) }
