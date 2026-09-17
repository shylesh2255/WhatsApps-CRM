// ============================================================
// GET  /api/account/webhooks — list this account's webhook endpoints
// POST /api/account/webhooks — register an endpoint
//
// Dashboard (cookie-session) counterpart of /api/v1/webhooks — same
// underlying `webhook_endpoints` table and helpers, authenticated the
// way every other Settings page is (requireRole) instead of an API
// key. GET is any role (roster isn't secret); POST is admin+, same
// as api-keys.
//
// POST returns the signing secret in plaintext exactly once — same
// one-time-reveal contract as /api/account/api-keys.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { encrypt } from '@/lib/whatsapp/encryption';
import { normalizeEvents } from '@/lib/webhooks/events';
import {
  WEBHOOK_PUBLIC_COLUMNS,
  serializeWebhookEndpoint,
  generateWebhookSecret,
  normalizeWebhookUrl,
} from '@/lib/webhooks/endpoints';

export async function GET() {
  try {
    const ctx = await requireRole('viewer');

    const { data, error } = await ctx.supabase
      .from('webhook_endpoints')
      .select(WEBHOOK_PUBLIC_COLUMNS)
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/account/webhooks] fetch error:', error);
      return NextResponse.json({ error: 'Failed to load webhooks' }, { status: 500 });
    }

    return NextResponse.json({
      webhooks: (data ?? []).map((r) => serializeWebhookEndpoint(r as Record<string, unknown>)),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');

    const limit = checkRateLimit(`admin:webhookCreate:${ctx.userId}`, RATE_LIMITS.adminAction);
    if (!limit.success) return rateLimitResponse(limit);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const url = normalizeWebhookUrl(body.url);
    if (!url) {
      return NextResponse.json({ error: "'url' must be a valid https:// URL" }, { status: 400 });
    }

    const events = normalizeEvents(body.events);
    if (!events) {
      return NextResponse.json(
        { error: "'events' must be a non-empty array of known event names" },
        { status: 400 },
      );
    }

    const secret = generateWebhookSecret();

    const { data: created, error } = await ctx.supabase
      .from('webhook_endpoints')
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        url,
        secret: encrypt(secret),
        events,
      })
      .select(WEBHOOK_PUBLIC_COLUMNS)
      .single();

    if (error || !created) {
      console.error('[POST /api/account/webhooks] create error:', error);
      return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
    }

    return NextResponse.json(
      { ...serializeWebhookEndpoint(created as Record<string, unknown>), secret },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
