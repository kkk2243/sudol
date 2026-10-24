import type { APIRoute } from 'astro';
import { handle, json } from '../../../lib/api';
import { bumpSessionVersion, clearSession } from '../../../lib/auth';

export const POST: APIRoute = ({ cookies, url }) =>
  handle(async () => {
    // 세션 버전을 올려 다른 기기에 남은 로그인까지 모두 무효화
    await bumpSessionVersion();
    clearSession(cookies, url.protocol === 'https:');
    return json({ ok: true });
  });
