import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { isValidUrl } from '@/lib/validation/format';

// Platform-wide ad banners, managed only by the platform owner. See
// supabase/migrations/071_ad_banners.sql for why this table has no
// authenticated-role write policy — this route is the only write path.
export async function GET() {
  try {
    await requirePlatformOwner();
    const admin = supabaseAdmin();
    const { data, error } = await admin.from('ad_banners').select('*').order('position');
    if (error) throw error;
    return NextResponse.json({ ads: data ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePlatformOwner();
    const body = (await request.json().catch(() => null)) as {
      companyName?: unknown;
      title?: unknown;
      description?: unknown;
      imageUrl?: unknown;
      linkUrl?: unknown;
      position?: unknown;
      durationSeconds?: unknown;
    } | null;

    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (!companyName || !imageUrl) {
      return NextResponse.json({ error: 'companyName and imageUrl are required' }, { status: 400 });
    }
    const linkUrl = typeof body?.linkUrl === 'string' ? body.linkUrl.trim() : '';
    if (linkUrl && !isValidUrl(linkUrl)) {
      return NextResponse.json({ error: 'Enter a valid link URL' }, { status: 400 });
    }
    const durationSeconds =
      typeof body?.durationSeconds === 'number' && body.durationSeconds >= 3 && body.durationSeconds <= 300
        ? Math.round(body.durationSeconds)
        : 30;

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('ad_banners')
      .insert({
        company_name: companyName,
        title: typeof body?.title === 'string' ? body.title.trim() || null : null,
        description: typeof body?.description === 'string' ? body.description.trim() || null : null,
        image_url: imageUrl,
        link_url: linkUrl || null,
        position: typeof body?.position === 'number' ? body.position : 0,
        display_duration_seconds: durationSeconds,
        created_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ad: data }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}
