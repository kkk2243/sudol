import type { APIRoute } from 'astro';
import { fail, handle, json, readJson, str } from '../../../lib/api';
import { renameTag } from '../../../lib/content';
import { normalizeTag } from '../../../lib/util';
import { purgePages } from '../../../lib/cache';

/** 태그 이름 변경/삭제. body: { from, to } — to 가 빈 문자열이면 모든 글에서 삭제 */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const body = await readJson(request, 2000);
    const from = str(body?.from, 40);
    const to = normalizeTag(str(body?.to, 40));
    if (!from) return fail('태그를 선택해 주세요.');
    const n = await renameTag(from, to);
    await purgePages();
    return json({ ok: true, changed: n });
  });
