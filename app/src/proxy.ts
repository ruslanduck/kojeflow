import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

const PUBLIC_PATHS = ['/login'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, signedIn } = await updateSession(request);

  if (pathname === '/login') {
    return signedIn ? NextResponse.redirect(new URL('/dashboard', request.url)) : response;
  }

  if (signedIn || PUBLIC_PATHS.includes(pathname)) return response;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|floorplan-1.png).*)'],
};
