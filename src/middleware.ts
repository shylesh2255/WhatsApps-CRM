import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // getUser() transparently refreshes an expired access token, which
  // ROTATES the refresh token and writes the new cookies onto
  // `supabaseResponse` via setAll() above. Any response we return in
  // place of `supabaseResponse` (every redirect / JSON branch below)
  // is a fresh object that does NOT carry those Set-Cookie headers, so
  // the rotated token never reaches the browser. The next request then
  // replays the old, now-consumed refresh token, the refresh fails, and
  // the session wedges — the user gets a broken reload after idling and
  // can only recover by manually clearing cookies (issue #288). Copy the
  // refreshed cookies onto whatever response we hand back to fix that.
  const withRefreshedCookies = <T extends NextResponse>(response: T): T => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  // Accounts are provisioned by admins. The old signup screen remains in
  // the tree for compatibility with existing invite links, but is not a
  // public account-creation route anymore.
  if (request.nextUrl.pathname === '/signup') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  // Auth pages - redirect to dashboard if already logged in.
  // Exception: when an invite token is in the query string we
  // send the already-signed-in user to /join/<token> instead so
  // they can accept the invitation in one click. Without this,
  // a forwarded invite link to someone who's already signed in
  // would silently drop them on /dashboard.
  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup' ||
      request.nextUrl.pathname === '/forgot-password')
  ) {
    const url = request.nextUrl.clone();
    const inviteToken = request.nextUrl.searchParams.get('invite');
    if (
      inviteToken &&
      (request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/signup')
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`;
      url.search = '';
    } else {
      url.pathname = '/dashboard';
      url.search = '';
    }
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  // Protected pages - redirect to login if not authenticated
  const protectedPaths = [
    '/dashboard',
    '/inbox',
    '/contacts',
    '/pipelines',
    '/broadcasts',
    '/automations',
    '/settings',
    '/customers',
    '/subscriptions',
    '/admin',
    '/branches',
    '/tasks',
    '/billing',
  ];
  if (
    !user &&
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  // Customer access is enforced here as a server-side request gate. Admins
  // retain access to manage billing and restore customer accounts.
  if (
    user &&
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path)) &&
    request.nextUrl.pathname !== '/change-password'
  ) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id, account_role, account_status, must_change_password')
      .eq('user_id', user.id)
      .maybeSingle();
    if (
      (profile?.account_role === 'owner' ||
        profile?.account_role === 'admin') &&
      request.nextUrl.pathname === '/billing'
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return withRefreshedCookies(NextResponse.redirect(url));
    }
    if (profile?.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = '/change-password';
      return withRefreshedCookies(NextResponse.redirect(url));
    }
    if (
      profile?.account_role !== 'owner' &&
      profile?.account_role !== 'admin' &&
      request.nextUrl.pathname !== '/billing'
    ) {
      const [
        { data: subscription },
        { data: account },
        { data: pendingPayment },
      ] = await Promise.all([
        supabase
          .from('customer_subscriptions')
          .select('status, payment_status, expiry_date')
          .eq('user_id', user.id)
          .order('expiry_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('accounts')
          .select('pending_payment_access')
          .eq('id', profile?.account_id)
          .maybeSingle(),
        supabase
          .from('customer_payments')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .limit(1)
          .maybeSingle(),
      ]);
      const allowed =
        (profile?.account_status === 'active' &&
          subscription?.payment_status === 'paid' &&
          ['active', 'trial', 'expiring_soon'].includes(subscription.status) &&
          (!subscription.expiry_date || new Date(subscription.expiry_date) > new Date())) ||
        Boolean(account?.pending_payment_access && pendingPayment);
      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = '/subscription-expired';
        return withRefreshedCookies(NextResponse.redirect(url));
      }
    }
  }

  // API routes that need auth (not webhooks)
  if (
    !user &&
    request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
    !request.nextUrl.pathname.includes('/webhook')
  ) {
    return withRefreshedCookies(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
