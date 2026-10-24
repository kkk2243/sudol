import { defineMiddleware } from 'astro:middleware';
import { checkCsrf, readSession, sameOrigin } from './lib/auth';
import { setNoStore } from './lib/cache';

const PUBLIC_ADMIN = new Set(['/admin/login', '/api/admin/login']);
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function securityHeaders(h: Headers, admin: boolean) {
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (admin) {
    h.set('X-Frame-Options', 'DENY');
    h.set('X-Robots-Tag', 'noindex, nofollow');
    setNoStore(h);
  } else {
    h.set('X-Frame-Options', 'SAMEORIGIN');
  }
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname.replace(/\/+$/, '') || '/';
  const isAdminPage = path === '/admin' || path.startsWith('/admin/');
  const isAdminApi = path.startsWith('/api/admin/');
  const isAdmin = isAdminPage || isAdminApi;
  ctx.locals.session = null;

  if (isAdmin) {
    let session = null;
    try {
      session = await readSession(ctx.cookies);
    } catch {
      session = null; // SESSION_SECRET 미설정 등 → 로그인 화면에서 안내
    }
    ctx.locals.session = session;

    if (!PUBLIC_ADMIN.has(path)) {
      if (!session) {
        if (isAdminApi) {
          const r = new Response(JSON.stringify({ ok: false, error: '로그인이 필요합니다.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
          securityHeaders(r.headers, true);
          return r;
        }
        const nextUrl = encodeURIComponent(ctx.url.pathname + ctx.url.search);
        return ctx.redirect(`/admin/login?next=${nextUrl}`, 302);
      }
      if (isAdminApi && UNSAFE.has(ctx.request.method)) {
        if (!sameOrigin(ctx.request, ctx.url) || !checkCsrf(session, ctx.request.headers.get('x-csrf-token'))) {
          const r = new Response(JSON.stringify({ ok: false, error: '보안 토큰이 유효하지 않습니다. 페이지를 새로고침해 주세요.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
          securityHeaders(r.headers, true);
          return r;
        }
      }
    } else if (path === '/api/admin/login' && UNSAFE.has(ctx.request.method) && !sameOrigin(ctx.request, ctx.url)) {
      return new Response(JSON.stringify({ ok: false, error: '잘못된 요청입니다.' }), { status: 403 });
    }
  }

  const res = await next();
  try {
    securityHeaders(res.headers, isAdmin);
  } catch {
    // 일부 응답(리다이렉트 등)은 헤더가 불변일 수 있음
  }
  return res;
});
