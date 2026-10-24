import type { APIRoute } from 'astro';
import { store } from '../../lib/storage';
import { isValidMediaKey } from '../../lib/media';
import { setMediaCache } from '../../lib/cache';

/**
 * 업로드 이미지 제공. 파일명이 바뀌지 않으므로 CDN·브라우저 모두 1년 캐시 → 같은 이미지는 사실상 한 번만 함수가 실행됨.
 */
export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? '';
  if (!isValidMediaKey(key)) return new Response('Not found', { status: 404 });
  const obj = await store('media').getBinary(key);
  if (!obj) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'public, s-maxage=60' },
    });
  }
  const headers = new Headers({
    'Content-Type': obj.contentType.startsWith('image/') ? obj.contentType : 'application/octet-stream',
    'Content-Length': String(obj.data.byteLength),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  setMediaCache(headers);
  return new Response(obj.data, { headers });
};
