import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new NextResponse(`Configuration manquante sur Vercel :\n- NEXT_PUBLIC_SUPABASE_URL ${url ? 'OK' : 'MANQUANT'}\n- NEXT_PUBLIC_SUPABASE_ANON_KEY ${key ? 'OK' : 'MANQUANT'}\nAjoutez-les dans Settings → Environment Variables puis redéployez.`, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  // Versioned routes authenticate their own cookie or Bearer token and return JSON errors.
  if (request.nextUrl.pathname.startsWith('/api/v1/')) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, { cookies: {
    getAll() { return request.cookies.getAll(); },
    setAll(c: { name: string; value: string; options: CookieOptions }[]) {
      c.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      c.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    } } });
  const { data: { user } } = await supabase.auth.getUser();
  const p = request.nextUrl.pathname;
  if (!user && !p.startsWith('/login')) { const u = request.nextUrl.clone(); u.pathname = '/login'; return NextResponse.redirect(u); }
  if (user && p === '/login') { const u = request.nextUrl.clone(); u.pathname = '/programme'; return NextResponse.redirect(u); }
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon.*).*)'] };
