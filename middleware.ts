import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't need auth
  const isPublicRoute = pathname === '/login' || pathname === '/pending-approval' || pathname.startsWith('/api/auth');

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Check approval status for authenticated users on protected routes
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approval_status')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.approval_status === 'pending' && pathname !== '/pending-approval') {
      const url = request.nextUrl.clone();
      url.pathname = '/pending-approval';
      return NextResponse.redirect(url);
    }

    if (profile?.approval_status === 'rejected') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'rejected');
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
