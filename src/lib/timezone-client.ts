export type ClientZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export const DEFAULT_TIMEZONE = 'Europe/Zagreb'

export function validTimeZone(value?: string | null) {
  if (!value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function safeTimeZone(value?: string | null) {
  return validTimeZone(value) ? String(value) : DEFAULT_TIMEZONE
}

export function deviceTimeZone() {
  try {
    return safeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return DEFAULT_TIMEZONE
  }
}

export function zonedPartsClient(value: Date | string, timeZone: string): ClientZonedParts {
  const date = value instanceof Date ? value : new Date(value)
  const tz = safeTimeZone(timeZone)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second }
}

function partsAsUtcMs(parts: ClientZonedParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

export function zonedPartsToUtc(parts: ClientZonedParts, timeZone: string) {
  const tz = safeTimeZone(timeZone)
  let guess = new Date(partsAsUtcMs(parts))
  for (let i = 0; i < 4; i += 1) {
    const actual = zonedPartsClient(guess, tz)
    const delta = partsAsUtcMs(parts) - partsAsUtcMs(actual)
    if (delta === 0) return guess
    guess = new Date(guess.getTime() + delta)
  }
  return guess
}

export function localDateTimeToIso(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = (time || '09:00').split(':').map(Number)
  return zonedPartsToUtc({ year, month, day, hour, minute, second: 0 }, timeZone).toISOString()
}

export function zonedDateKey(value: Date | string, timeZone: string) {
  const p = zonedPartsClient(value, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function zonedTime(value: Date | string, timeZone: string) {
  const p = zonedPartsClient(value, timeZone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

export function startOfZonedDayIso(key: string, timeZone: string) {
  return localDateTimeToIso(key, '00:00', timeZone)
}

export function endOfZonedDayIso(key: string, timeZone: string) {
  const [year, month, day] = key.split('-').map(Number)
  return zonedPartsToUtc({ year, month, day, hour: 23, minute: 59, second: 59 }, timeZone).toISOString()
}

export function moveIsoToZonedDateKeepingTime(iso: string | null | undefined, date: string, timeZone: string, fallbackTime = '09:00') {
  let time = fallbackTime
  if (iso) time = zonedTime(iso, timeZone)
  return localDateTimeToIso(date, time, timeZone)
}

export function formatInTimeZone(value: Date | string, locale: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: safeTimeZone(timeZone) }).format(date)
}
