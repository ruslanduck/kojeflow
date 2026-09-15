import { NextResponse } from 'next/server';

const AUTH_COOKIE = 'kf_auth';

export async function POST(request: Request) {
  const validEmail = process.env.AUTH_EMAIL;
  const validPassword = process.env.AUTH_PASSWORD;

  if (!validEmail || !validPassword) {
    return NextResponse.json({ error: 'Auth is not configured' }, { status: 500 });
  }

  const { email, password } = await request.json().catch(() => ({}));

  if (email !== validEmail || password !== validPassword) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
