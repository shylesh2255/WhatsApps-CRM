// ============================================================
// Recognizes the plan-limit trigger error raised by
// supabase/migrations/074_plan_limits.sql (`enforce_plan_count_limit`)
// on contacts/products inserts, so client forms can show a friendly
// toast instead of the raw Postgres exception text.
// ============================================================

export function isPlanLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "P0001" && typeof e.message === "string" && e.message.includes("plan_limit_reached");
}

export const PLAN_LIMIT_MESSAGE =
  "You've reached your plan's limit for this. Upgrade your plan to add more.";
