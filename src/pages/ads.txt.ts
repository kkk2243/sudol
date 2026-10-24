import type { APIRoute } from 'astro';
import { getSettings } from '../lib/content';
import { setPublicCache } from '../lib/cache';

/**
 * ads.txt
 * - 관리자 설정에 ads.txt 내용을 직접 넣었으면 그대로 출력
 * - 비어 있고 애드센스 ID만 있으면 Google 표준 한 줄을 자동 생성
 * - 둘 다 없으면 404
 */
export const GET: APIRoute = async () => {
  const s = await getSettings();
  let body = s.adsTxt.trim();
  if (!body && /^ca-pub-\d{10,20}$/.test(s.adsenseClient)) {
    body = `google.com, ${s.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0`;
  }
  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  setPublicCache(headers);
  if (!body) return new Response('Not found\n', { status: 404, headers });
  return new Response(body + '\n', { headers });
};
