import type { APIRoute } from 'astro';
import { handle, json, readJson } from '../../../../lib/api';
import { getCategories, savePost, uniqueSlug } from '../../../../lib/content';
import { buildPost } from '../../../../lib/validate';
import { purgePages } from '../../../../lib/cache';

/** 새 글 만들기 */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const raw = await readJson(request, 600_000);
    const post = buildPost(raw, null, await getCategories());
    post.slug = await uniqueSlug(post.slug);
    await savePost(post);
    if (post.status === 'published') await purgePages();
    return json({ ok: true, id: post.id, slug: post.slug, updatedAt: post.updatedAt });
  });
