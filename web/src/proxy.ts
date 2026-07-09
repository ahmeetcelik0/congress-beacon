import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_TOKEN_COOKIE_NAME } from './lib/admin-token';

const PUBLIC_PATHS = ['/admin/login'];

// Bu, iyimser (optimistic) bir kontrol: yalnizca cookie'nin varligina bakar,
// gercek yetkilendirme her istekte backend'deki AdminJwtGuard tarafindan yapilir.
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const token = request.cookies.get(ADMIN_TOKEN_COOKIE_NAME)?.value;

  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/admin/login', request.nextUrl));
  }

  if (pathname.startsWith('/admin/login') && token) {
    return NextResponse.redirect(new URL('/congresses', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
