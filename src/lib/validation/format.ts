// Shared format checks for form fields across the app. Client-side use
// only stops honest mistakes in the UI — the real backstop for direct
// API/Supabase calls is the DB CHECK constraints added alongside these
// (see supabase/migrations/068_field_format_constraints.sql).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose international phone check: optional leading +, 7-15 digits,
// spaces/hyphens allowed. Deliberately permissive — this app has
// customers across countries with different phone formats.
const PHONE_RE = /^\+?[\d\s-]{7,20}$/;
// India GST: 2-digit state code, 10-char PAN, 1-digit entity code,
// literal 'Z', 1-char checksum. e.g. 22AAAAA0000A1Z5
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

export function isValidGstNumber(value: string): boolean {
  return GST_RE.test(value.trim().toUpperCase());
}

export function isValidUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Clamps a percent-style field (discount %, tax %) into [0, 100]. */
export function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Clamps a monetary/quantity field to non-negative. */
export function clampNonNegative(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, value);
}
