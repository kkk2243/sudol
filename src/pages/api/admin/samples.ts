import type { APIRoute } from 'astro';
import { handle, json } from '../../../lib/api';
import { deleteSamples } from '../../../lib/content';
import { purgePages } from '../../../lib/cache';

/** "샘플" 표시가 붙은 글을 모두 삭제 */
export const DELETE: APIRoute = () =>
  handle(async () => {
    const n = await deleteSamples();
    await purgePages();
    return json({ ok: true, deleted: n });
  });
