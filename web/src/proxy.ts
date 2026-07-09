import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_TOKEN_COOKIE_NAME } from './lib/admin-token';

const PUBLIC_PATHS = ['/admin/login'];

// Bu, iyimser (optimistic) bir kontrol: yalnizca cookie'nin varligina bakar,
// gercek yetkilendirme her istekte backend'deki AdminJwtGuard tarafindan yapilir.
export default function proxy(request: NextRequest) {
  const { basePath } = request.nextUrl;
  // pathname bazi Next surumlerinde basePath'i icerir bazilarinda icermez;
  // guvenli olmak icin varsa manuel temizliyoruz, yonlendirme hedeflerine de
  // basePath'i biz kendimiz ekliyoruz (aksi halde production'da /yetkili
  // onekini kaybedip 404'e dusuyor).
  const rawPathname = request.nextUrl.pathname;
  const pathname =
    basePath && rawPathname.startsWith(basePath)
      ? rawPathname.slice(basePath.length) || '/'
      : rawPathname;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const token = request.cookies.get(ADMIN_TOKEN_COOKIE_NAME)?.value;

  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL(`${basePath}/admin/login`, request.url));
  }

  if (pathname.startsWith('/admin/login') && token) {
    return NextResponse.redirect(new URL(`${basePath}/congresses`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
