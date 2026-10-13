import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

const PUBLIC_PATHS = ['/login'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, signedIn } = await updateSession(request);

  // Redirects keep the cookies the session refresh may have just set.
  const redirect = (url: URL) => {
    const out = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => out.cookies.set(c));
    return out;
  };

  if (pathname === '/login') {
    return signedIn ? redirect(new URL('/dashboard', request.url)) : response;
  }

  if (signedIn || PUBLIC_PATHS.includes(pathname)) return response;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  // The page asked for comes back after signing in, so shared links (a stay, a person) still work.
  const login = new URL('/login', request.url);
  if (pathname !== '/' && pathname !== '/dashboard') login.searchParams.set('next', pathname + request.nextUrl.search);
  return redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|floorplan-1.png).*)'],
};
