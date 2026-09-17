"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Moon, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";

// A short, common list rather than the full IANA database — this
// account setting only needs to be "close enough" per-tenant, not a
// full timezone picker.
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Karachi",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

interface QuietHoursRow {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
}

/**
 * Account-wide quiet hours for automation/broadcast sends (never
 * manual agent replies) — see 077_quiet_hours.sql. A send that would
 * land inside this window is skipped and logged, not deferred (no
 * job queue exists), so this is a hard boundary, not a "smart delay".
 */
export function QuietHoursSettings() {
  const supabase = createClient();
  const { accountId, canEditSettings, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("08:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("accounts")
        .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone")
        .eq("id", accountId)
        .maybeSingle<QuietHoursRow>();
      if (cancelled || !data) return;
      setEnabled(data.quiet_hours_enabled);
      setStart((data.quiet_hours_start ?? "22:00").slice(0, 5));
      setEnd((data.quiet_hours_end ?? "08:00").slice(0, 5));
      setTimezone(data.quiet_hours_timezone || "Asia/Kolkata");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, supabase]);

  async function handleSave() {
    if (!accountId) return;
    setSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({
        quiet_hours_enabled: enabled,
        quiet_hours_start: start,
        quiet_hours_end: end,
        quiet_hours_timezone: timezone,
      })
      .eq("id", accountId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save quiet hours");
      return;
    }
    toast.success("Quiet hours saved");
  }

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Quiet Hours"
        description="Pause automated sends during a window each day — manual agent replies are never affected."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Moon className="size-4 text-primary" />
            Automated send window
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            While enabled, automations and broadcasts skip any send that falls inside this
            window instead of sending it. Manual replies from your team always go through.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || profileLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2.5">
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => setEnabled(!!v)}
                  disabled={!canEditSettings}
                />
                <span className="text-sm text-foreground">Enable quiet hours</span>
              </label>

              <div className="grid gap-4 sm:grid-cols-3 sm:max-w-md">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Starts</Label>
                  <input
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    disabled={!canEditSettings}
                    className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Ends</Label>
                  <input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    disabled={!canEditSettings}
                    className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Timezone</Label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={!canEditSettings}
                    className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!canEditSettings && (
                <p className="text-xs text-muted-foreground">
                  Only account admins can change quiet hours.
                </p>
              )}

              {canEditSettings && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
