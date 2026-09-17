'use client';

// ============================================================
// WebhooksSettings — Settings → Webhooks
//
// Dashboard management for outgoing event webhooks (see
// src/lib/webhooks/{events,endpoints,deliver}.ts and migration
// 028_webhook_endpoints.sql). Any member sees the roster; admin+ can
// register/edit/delete, mirroring ApiKeysSettings' permission model.
//
// One-time reveal: a freshly-created endpoint's signing secret is
// shown ONCE in the creation dialog, same contract as an API key.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2, Plus, Trash2, Webhook as WebhookIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/hooks/use-auth';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_DESCRIPTIONS, type WebhookEvent } from '@/lib/webhooks/events';
import { SettingsPanelHead } from './settings-panel-head';

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  failure_count: number;
  created_at: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function WebhooksSettings() {
  const { canEditSettings } = useAuth();

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/webhooks', { cache: 'no-store' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to load webhooks');
        return;
      }
      const data = (await res.json()) as { webhooks: WebhookEndpoint[] };
      setWebhooks(data.webhooks);
    } catch (err) {
      console.error('[WebhooksSettings] load error:', err);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(webhook: WebhookEndpoint) {
    setBusyId(webhook.id);
    try {
      const res = await fetch(`/api/account/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !webhook.is_active }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to update webhook');
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(webhook: WebhookEndpoint) {
    setBusyId(webhook.id);
    try {
      const res = await fetch(`/api/account/webhooks/${webhook.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to delete webhook');
        return;
      }
      toast.success('Webhook deleted');
      setWebhooks((prev) => prev.filter((w) => w.id !== webhook.id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-6 duration-200">
      <SettingsPanelHead
        title="Webhooks"
        description="Get a POST request when something happens in your account — a message arrives, an automation finishes, a conversation opens."
        action={
          <RequireRole min="admin">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New webhook
            </Button>
          </RequireRole>
        }
      />

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <WebhookIcon className="text-muted-foreground size-6" />
            <p className="text-muted-foreground mt-2 text-sm">No webhooks yet.</p>
            {canEditSettings ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Register a URL to start receiving events.
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">
                Ask an account admin to set one up.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-border divide-y">
              {webhooks.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`truncate text-sm font-medium ${
                          w.is_active ? 'text-foreground' : 'text-muted-foreground line-through'
                        }`}
                      >
                        {w.url}
                      </span>
                      {w.failure_count > 0 && w.is_active && (
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 tracking-wide uppercase dark:text-amber-400">
                          {w.failure_count} failing
                        </Badge>
                      )}
                      {!w.is_active && (
                        <Badge className="border-border bg-muted text-muted-foreground text-[10px] tracking-wide uppercase">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {w.events.map((e) => (
                        <Badge key={e} className="border-border bg-muted text-muted-foreground text-[10px]">
                          {e}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      Created {fmtDate(w.created_at)}
                      {' · '}
                      {w.last_delivery_at
                        ? `Last delivered ${fmtDate(w.last_delivery_at)}`
                        : 'Never delivered'}
                    </p>
                  </div>

                  <RequireRole min="admin">
                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <Switch
                        checked={w.is_active}
                        onCheckedChange={() => toggleActive(w)}
                        disabled={busyId === w.id}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(w)}
                        disabled={busyId === w.id}
                        className="border-red-500/40 bg-red-500/10 text-red-300 hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-200"
                      >
                        {busyId === w.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </RequireRole>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CreateWebhookDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </section>
  );
}

// ------------------------------------------------------------
// Create dialog — form → one-time secret reveal.
// ------------------------------------------------------------

function CreateWebhookDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  function reset() {
    setUrl('');
    setEvents([]);
    setSubmitting(false);
    setCreatedSecret(null);
  }

  function toggleEvent(event: WebhookEvent, checked: boolean) {
    setEvents((prev) => (checked ? [...prev, event] : prev.filter((e) => e !== event)));
  }

  async function handleCreate() {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error('URL is required');
      return;
    }
    if (events.length === 0) {
      toast.error('Select at least one event');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, events }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error || 'Failed to create webhook');
        return;
      }
      setCreatedSecret(payload.secret as string);
      onCreated();
    } catch (err) {
      console.error('[CreateWebhookDialog] create error:', err);
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function copySecret() {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-border bg-popover sm:max-w-md">
        {createdSecret ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">Save your signing secret</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This is shown once. Use it to verify the{' '}
                <code className="text-xs">X-Wacrm-Signature</code> header on every delivery — we
                only keep an encrypted copy and can&rsquo;t show it again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Signing secret</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={createdSecret}
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="outline" onClick={copySecret}>
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">New webhook</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                We&rsquo;ll POST a signed JSON payload to this URL for each event you select.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="webhook-url" className="text-muted-foreground">
                  URL
                </Label>
                <Input
                  id="webhook-url"
                  value={url}
                  placeholder="https://example.com/webhooks/wacrm"
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Events</Label>
                <div className="border-border space-y-2 rounded-md border p-3">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event} className="flex cursor-pointer items-start gap-2.5">
                      <Checkbox
                        checked={events.includes(event)}
                        onCheckedChange={(checked) => toggleEvent(event, checked === true)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="text-foreground block font-mono text-xs">{event}</span>
                        <span className="text-muted-foreground block text-xs">
                          {WEBHOOK_EVENT_DESCRIPTIONS[event]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
                className="border-border text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create webhook'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
