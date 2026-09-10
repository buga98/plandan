export type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export const DEFAULT_TIMEZONE = 'Europe/Zagreb'

export function safeTimeZone(value?: string | null) {
  if (!value) return DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    return DEFAULT_TIMEZONE
  }
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)])
  ) as Record<string, number>
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  }
}

function partsAsUtcMs(parts: ZonedParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

export function zonedDateToUtc(parts: ZonedParts, timeZone: string) {
  const tz = safeTimeZone(timeZone)
  let guess = new Date(partsAsUtcMs(parts))
  for (let i = 0; i < 4; i += 1) {
    const actual = zonedParts(guess, tz)
    const delta = partsAsUtcMs(parts) - partsAsUtcMs(actual)
    if (delta === 0) break
    guess = new Date(guess.getTime() + delta)
  }
  return guess
}

export function localDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return zonedDateToUtc({ year, month, day, hour, minute, second: 0 }, timeZone)
}

export function zonedDateKey(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function shiftDateKey(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function zonedDayRange(fromKey: string, toKey: string, timeZone: string) {
  const tz = safeTimeZone(timeZone)
  const from = localDateTimeToUtc(fromKey, '00:00', tz)
  const nextDay = localDateTimeToUtc(shiftDateKey(toKey, 1), '00:00', tz)
  return { from, to: new Date(nextDay.getTime() - 1) }
}

// Semantic calendar-only dates are intentionally stored as UTC midnight.
export function semanticDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}
