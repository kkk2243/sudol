import type { APIRoute } from 'astro';
import { fail, handle, json, readJson, str } from '../../../lib/api';
import {
  authConfigError,
  clearLoginFailures,
  clientIp,
  createSession,
  loginLockedFor,
  recordLoginFailure,
  verifyCredentials,
} from '../../../lib/auth';

export const POST: APIRoute = ({ request, cookies, url, clientAddress, redirect }) =>
  handle(async () => {
    const cfg = authConfigError();
    if (cfg) return fail(`관리자 설정이 완료되지 않았습니다: ${cfg}`, 500);

    let addr: string | undefined;
    try {
      addr = clientAddress;
    } catch {}
    const ip = clientIp(request, addr);

    const locked = await loginLockedFor(ip);
    if (locked > 0) {
      return fail(`로그인 시도가 너무 많아요. ${Math.ceil(locked / 60000)}분 후에 다시 시도해 주세요.`, 429);
    }

    // JS 가 꺼진 브라우저의 일반 폼 전송도 지원(성공/실패 시 리다이렉트)
    const isForm = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
    let body: any;
    if (isForm) {
      const fd = await request.formData();
      body = { id: fd.get('id'), password: fd.get('password'), next: fd.get('next') };
    } else {
      body = await readJson(request, 4096);
    }
    const back = (msg: string) =>
      isForm ? redirect(`/admin/login?error=${encodeURIComponent(msg)}`) : fail(msg, 401);
    const id = str(body?.id, 100);
    const password = typeof body?.password === 'string' ? body.password.slice(0, 200) : '';
    if (!id || !password) return back('아이디와 비밀번호를 입력해 주세요.');

    if (!(await verifyCredentials(id, password))) {
      const { remaining } = await recordLoginFailure(ip);
      return back(remaining > 0 ? `아이디 또는 비밀번호가 맞지 않아요. (남은 시도 ${remaining}회)` : '로그인 시도가 너무 많아 15분간 잠겼어요.');
    }

    await clearLoginFailures(ip);
    await createSession(cookies, url.protocol === 'https:');
    if (isForm) {
      const next = typeof body.next === 'string' && body.next.startsWith('/admin') && !body.next.startsWith('//') ? body.next : '/admin';
      return redirect(next);
    }
    return json({ ok: true });
  });
