import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(191),
  password: z.string().min(8).max(100),
  language: z.enum(['HR', 'EN', 'DE']).default('HR')
})

export const loginSchema = z.object({
  email: z.string().trim().email().max(191),
  password: z.string().min(1).max(100)
})

export const itemSchema = z.object({
  type: z.enum(['TASK', 'EVENT', 'NOTE']).default('TASK'),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(10000).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().default(false),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  category: z.string().trim().max(60).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  isInbox: z.boolean().default(false),
  repeatType: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).default('NONE'),
  repeatInterval: z.number().int().min(1).max(99).default(1),
  repeatUntil: z.string().datetime().optional().nullable(),
  reminderOffsets: z.array(z.number().int().min(0).max(525600)).max(8).default([])
})

const timezoneSchema = z.string().min(1).max(80).refine((value) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date()); return true } catch { return false }
}, 'Invalid IANA timezone')

export const settingsSchema = z.object({
  language: z.enum(['HR', 'EN', 'DE']).optional(),
  theme: z.enum(['SYSTEM', 'LIGHT', 'DARK']).optional(),
  timezone: timezoneSchema.optional(),
  weekStartsMonday: z.boolean().optional(),
  focusMinutes: z.number().int().min(5).max(180).optional(),
  breakMinutes: z.number().int().min(1).max(60).optional(),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  holidayCountry: z.enum(['HR','DE','AT','CH','GB','US']).optional(),
  showHolidays: z.boolean().optional()
})
