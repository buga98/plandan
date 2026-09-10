export type Language = 'HR' | 'EN' | 'DE'
export type Theme = 'SYSTEM' | 'LIGHT' | 'DARK'
export type ItemType = 'TASK' | 'EVENT' | 'NOTE'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type RepeatType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export type Reminder = { id?: string; offsetMinutes: number }
export type OccurrenceState = { id?: string; occurrenceAt: string; completedAt?: string | null; skippedAt?: string | null }

export type PlannerItem = {
  id: string
  userId?: string
  type: ItemType
  title: string
  description?: string | null
  startAt?: string | null
  endAt?: string | null
  dueAt?: string | null
  allDay: boolean
  completedAt?: string | null
  priority: Priority
  category?: string | null
  color?: string | null
  isInbox: boolean
  repeatType: RepeatType
  repeatInterval: number
  repeatUntil?: string | null
  createdAt?: string
  updatedAt?: string
  reminders: Reminder[]
  occurrenceStates?: OccurrenceState[]
}

export type HabitCheckin = { id?: string; date: string; count?: number }
export type Habit = {
  id: string
  userId?: string
  name: string
  emoji: string
  color: string
  targetPerWeek: number
  targetPerDay: number
  reminderMode: 'NONE' | 'FIXED' | 'INTERVAL'
  reminderTime?: string | null
  reminderIntervalMinutes?: number | null
  reminderStartTime?: string | null
  reminderEndTime?: string | null
  archived?: boolean
  checkins: HabitCheckin[]
}

export type Reflection = {
  id?: string
  date: string
  mood?: number | null
  energy?: number | null
  gratitude?: string | null
  note?: string | null
}

export type FocusSession = {
  id?: string
  durationMin: number
  label?: string | null
  completed: boolean
  startedAt: string
  endedAt: string
}

export type DayOff = { id: string; date: string; label: string; color: string }

export type Settings = {
  language: Language
  theme: Theme
  timezone: string
  weekStartsMonday?: boolean
  focusMinutes: number
  breakMinutes: number
  quietStart?: string | null
  quietEnd?: string | null
  holidayCountry?: string
  showHolidays?: boolean
}

export type Bootstrap = {
  syncedAt?: string
  profile: { id: string; name: string; email: string }
  settings: Settings | null
  items: PlannerItem[]
  habits: Habit[]
  reflections: Reflection[]
  focusSessions: FocusSession[]
  dayOffs: DayOff[]
}

export type Occurrence = {
  item: PlannerItem
  occurrenceAt: string
  occurrenceEndAt?: string | null
  completedAt?: string | null
}
