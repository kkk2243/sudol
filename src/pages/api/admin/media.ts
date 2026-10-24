import type { APIRoute } from 'astro';
import { fail, handle, json, readJson } from '../../../lib/api';
import { store } from '../../../lib/storage';
import { MAX_UPLOAD_BYTES, contentTypeForExt, extForType, isValidMediaKey, sniffImageType } from '../../../lib/media';
import { getAllPosts, getSettings } from '../../../lib/content';

/** 가져오기: 원래 키 그대로 이미지 한 장 저장.  PUT /api/admin/media?key=202610/abc_1600x1200.webp */
export const PUT: APIRoute = ({ request, url }) =>
  handle(async () => {
    const key = url.searchParams.get('key') || '';
    if (!isValidMediaKey(key)) return fail('잘못된 이미지 키예요.');
    const len = Number(request.headers.get('content-length') || '0');
    if (len > MAX_UPLOAD_BYTES) return fail('이미지가 너무 커요.', 413);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) return fail('이미지가 너무 커요.', 413);
    const type = sniffImageType(bytes);
    const ext = type ? extForType(type) : null;
    if (!ext || !key.endsWith('.' + ext)) return fail('이미지 형식이 키와 맞지 않아요.');
    await store('media').setBinary(key, bytes, contentTypeForExt(ext));
    return json({ ok: true });
  });

/**
 * 어느 글·설정에서도 쓰지 않는 이미지 찾기/삭제
 * GET  → { unused: string[] }
 * POST { keys: string[] } → 삭제
 */
async function findUnused(): Promise<string[]> {
  const [posts, settings, keys] = await Promise.all([getAllPosts(), getSettings(), store('media').list('')]);
  const text = JSON.stringify(posts) + JSON.stringify(settings);
  return keys.filter((k) => {
    const base = k.replace(/@\d+(\.[a-z]+)$/, '$1');
    return !text.includes(base);
  });
}

export const GET: APIRoute = () => handle(async () => json({ ok: true, unused: await findUnused() }));

export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const body = await readJson(request, 200_000);
    const want = new Set<string>(Array.isArray(body?.keys) ? body.keys : []);
    const unused = await findUnused();
    let n = 0;
    for (const k of unused) {
      if (!want.has(k)) continue;
      await store('media').delete(k);
      n++;
    }
    return json({ ok: true, deleted: n });
  });
