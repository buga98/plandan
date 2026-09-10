import type { PlannerItem, RepeatType } from '@prisma/client'
import { zonedDateToUtc, zonedParts } from './timezone'

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function addLocal(parts: ReturnType<typeof zonedParts>, repeat: RepeatType, interval: number, n: number) {
  const step = Math.max(1, interval) * n
  if (repeat === 'DAILY' || repeat === 'WEEKLY') {
    const days = repeat === 'DAILY' ? step : step * 7
    const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second))
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second
    }
  }
  if (repeat === 'MONTHLY') {
    const rawMonth = parts.month - 1 + step
    const year = parts.year + Math.floor(rawMonth / 12)
    const monthIndex = ((rawMonth % 12) + 12) % 12
    const month = monthIndex + 1
    return {
      year,
      month,
      day: Math.min(parts.day, daysInMonth(year, month)),
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second
    }
  }
  if (repeat === 'YEARLY') {
    const year = parts.year + step
    return {
      year,
      month: parts.month,
      day: Math.min(parts.day, daysInMonth(year, parts.month)),
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second
    }
  }
  return parts
}

export function itemBaseDate(item: Pick<PlannerItem, 'startAt' | 'dueAt'>) {
  return item.startAt || item.dueAt || null
}

export function occurrencesBetween(
  item: Pick<PlannerItem, 'startAt' | 'dueAt' | 'repeatType' | 'repeatInterval' | 'repeatUntil'>,
  from: Date,
  to: Date,
  timeZone = 'Europe/Zagreb',
  max = 5000
) {
  const base = itemBaseDate(item)
  if (!base || to < from) return [] as Date[]

  if (item.repeatType === 'NONE') {
    return base >= from && base <= to ? [base] : []
  }

  const baseParts = zonedParts(base, timeZone)
  const results: Date[] = []
  let n = 0
  while (n < max) {
    const candidate = zonedDateToUtc(addLocal(baseParts, item.repeatType, item.repeatInterval, n), timeZone)
    if (item.repeatUntil && candidate > item.repeatUntil) break
    if (candidate > to) break
    if (candidate >= from) results.push(candidate)
    n += 1
  }
  return results
}
