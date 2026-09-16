import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { isValidUrl } from '@/lib/validation/format';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformOwner();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      companyName?: unknown;
      title?: unknown;
      description?: unknown;
      imageUrl?: unknown;
      linkUrl?: unknown;
      position?: unknown;
      active?: unknown;
      durationSeconds?: unknown;
    } | null;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body?.companyName === 'string') {
      const companyName = body.companyName.trim();
      if (!companyName) return NextResponse.json({ error: 'companyName cannot be empty' }, { status: 400 });
      updates.company_name = companyName;
    }
    if (typeof body?.title === 'string') updates.title = body.title.trim() || null;
    if (typeof body?.description === 'string') updates.description = body.description.trim() || null;
    if (typeof body?.imageUrl === 'string') {
      const imageUrl = body.imageUrl.trim();
      if (!imageUrl) return NextResponse.json({ error: 'imageUrl cannot be empty' }, { status: 400 });
      updates.image_url = imageUrl;
    }
    if (typeof body?.linkUrl === 'string') {
      const linkUrl = body.linkUrl.trim();
      if (linkUrl && !isValidUrl(linkUrl)) return NextResponse.json({ error: 'Enter a valid link URL' }, { status: 400 });
      updates.link_url = linkUrl || null;
    }
    if (typeof body?.position === 'number') updates.position = body.position;
    if (typeof body?.active === 'boolean') updates.active = body.active;
    if (typeof body?.durationSeconds === 'number' && body.durationSeconds >= 3 && body.durationSeconds <= 300) {
      updates.display_duration_seconds = Math.round(body.durationSeconds);
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.from('ad_banners').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ ad: data });
  } catch (error) { return toErrorResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformOwner();
    const { id } = await params;
    const admin = supabaseAdmin();
    const { error } = await admin.from('ad_banners').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { return toErrorResponse(error); }
}
