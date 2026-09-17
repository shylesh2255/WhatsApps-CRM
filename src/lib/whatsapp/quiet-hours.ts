// ============================================================
// Account-level quiet hours for automated (automation/broadcast) sends.
// See 077_quiet_hours.sql — manual agent replies are never gated by this.
// ============================================================

export interface QuietHoursAccount {
  quiet_hours_enabled: boolean | null;
  quiet_hours_start: string | null; // 'HH:mm:ss' (Postgres TIME)
  quiet_hours_end: string | null;
  quiet_hours_timezone: string | null;
}

/** Parses a Postgres TIME string ('HH:mm' or 'HH:mm:ss') into minutes-since-midnight. */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * True if "now" falls inside the account's configured quiet-hours
 * window, in the account's own timezone. Handles an overnight window
 * (e.g. 22:00–08:00) via wraparound.
 */
export function isWithinQuietHours(account: QuietHoursAccount, now: Date = new Date()): boolean {
  if (!account.quiet_hours_enabled || !account.quiet_hours_start || !account.quiet_hours_end) {
    return false
  }

  const timeZone = account.quiet_hours_timezone || 'Asia/Kolkata'
  let localTime: string
  try {
    localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now)
  } catch {
    // Unknown/invalid timezone string — fail open rather than block sends.
    return false
  }

  const nowMin = toMinutes(localTime)
  const startMin = toMinutes(account.quiet_hours_start)
  const endMin = toMinutes(account.quiet_hours_end)

  if (startMin === endMin) return false // degenerate config — treat as "always off"
  if (startMin < endMin) {
    // Same-day window, e.g. 13:00–18:00
    return nowMin >= startMin && nowMin < endMin
  }
  // Overnight window, e.g. 22:00–08:00
  return nowMin >= startMin || nowMin < endMin
}
