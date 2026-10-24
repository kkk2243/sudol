import type { APIRoute } from 'astro';
import { fail, handle, json, readJson } from '../../../lib/api';
import { getCategories, getIndex, getSettings, importPosts, saveCategories, saveSettings } from '../../../lib/content';
import { buildCategories, buildSettings, sanitizeImportedPost } from '../../../lib/validate';
import { purgePages } from '../../../lib/cache';

/**
 * 가져오기(여러 번 나눠 호출 가능)
 * body: { settings?, categories?, posts?: Post[] } — posts 는 한 번에 50개까지
 * 같은 id 의 글은 덮어씁니다.
 */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const body = await readJson(request, 5_000_000);
    if (body?.categories) await saveCategories(buildCategories(body.categories));
    if (body?.settings) await saveSettings(buildSettings(body.settings, await getSettings()));
    let n = 0;
    if (Array.isArray(body?.posts)) {
      if (body.posts.length > 50) return fail('글은 한 번에 50개까지 가져올 수 있어요.');
      const cats = await getCategories();
      const posts = body.posts.map((p: unknown) => sanitizeImportedPost(p, cats));
      // 다른 글과 슬러그가 겹치면 -2, -3 … 을 붙임
      const taken = new Map((await getIndex()).map((s) => [s.slug, s.id]));
      for (const p of posts) {
        let slug = p.slug;
        for (let i = 2; taken.has(slug) && taken.get(slug) !== p.id; i++) slug = `${p.slug}-${i}`;
        p.slug = slug;
        taken.set(slug, p.id);
      }
      n = await importPosts(posts);
    }
    if (body?.done) await purgePages();
    return json({ ok: true, imported: n });
  });
