import { describe, it, expect } from 'vitest'
import { isWithinQuietHours } from './quiet-hours'

const TZ = 'Asia/Kolkata' // UTC+5:30, no DST — deterministic for fixed UTC instants

describe('isWithinQuietHours', () => {
  it('is false when disabled', () => {
    const account = {
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      quiet_hours_timezone: TZ,
    }
    expect(isWithinQuietHours(account, new Date('2024-01-01T20:00:00Z'))).toBe(false)
  })

  it('is false when start/end are missing', () => {
    const account = {
      quiet_hours_enabled: true,
      quiet_hours_start: null,
      quiet_hours_end: null,
      quiet_hours_timezone: TZ,
    }
    expect(isWithinQuietHours(account, new Date('2024-01-01T20:00:00Z'))).toBe(false)
  })

  it('matches a same-day window (13:00-18:00 IST)', () => {
    const account = {
      quiet_hours_enabled: true,
      quiet_hours_start: '13:00',
      quiet_hours_end: '18:00',
      quiet_hours_timezone: TZ,
    }
    // 15:00 UTC = 20:30 IST — outside
    expect(isWithinQuietHours(account, new Date('2024-01-01T15:00:00Z'))).toBe(false)
    // 08:00 UTC = 13:30 IST — inside
    expect(isWithinQuietHours(account, new Date('2024-01-01T08:00:00Z'))).toBe(true)
  })

  it('matches an overnight window (22:00-08:00 IST) via wraparound', () => {
    const account = {
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      quiet_hours_timezone: TZ,
    }
    // 19:00 UTC = 00:30 IST (next day) — inside the overnight window
    expect(isWithinQuietHours(account, new Date('2024-01-01T19:00:00Z'))).toBe(true)
    // 08:00 UTC = 13:30 IST — outside
    expect(isWithinQuietHours(account, new Date('2024-01-01T08:00:00Z'))).toBe(false)
  })

  it('treats an identical start/end as always-off', () => {
    const account = {
      quiet_hours_enabled: true,
      quiet_hours_start: '09:00',
      quiet_hours_end: '09:00',
      quiet_hours_timezone: TZ,
    }
    expect(isWithinQuietHours(account, new Date('2024-01-01T03:30:00Z'))).toBe(false)
  })

  it('fails open on an invalid timezone', () => {
    const account = {
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      quiet_hours_timezone: 'Not/ATimezone',
    }
    expect(isWithinQuietHours(account, new Date('2024-01-01T19:00:00Z'))).toBe(false)
  })
})
