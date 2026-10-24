import type { APIRoute } from 'astro';
import { fail, handle, json, readJson } from '../../../lib/api';
import { getCategories, getIndex, moveCategory, saveCategories } from '../../../lib/content';
import { buildCategories } from '../../../lib/validate';
import { purgePages } from '../../../lib/cache';

/**
 * 카테고리 전체 저장.
 * body: { categories: Category[], renames?: { from: string; to: string }[] }
 * - renames: 주소(slug)를 바꾼 경우 글들의 카테고리도 함께 옮김
 * - 글이 남아 있는 카테고리는 삭제 불가
 */
export const PUT: APIRoute = ({ request }) =>
  handle(async () => {
    const body = await readJson(request, 50_000);
    const next = buildCategories(body?.categories);
    const renames: { from: string; to: string }[] = Array.isArray(body?.renames) ? body.renames : [];
    const prev = await getCategories();
    const nextSlugs = new Set(next.map((c) => c.slug));

    for (const r of renames) {
      if (typeof r?.from !== 'string' || typeof r?.to !== 'string' || r.from === r.to) continue;
      if (!prev.some((c) => c.slug === r.from) || !nextSlugs.has(r.to)) continue;
      await moveCategory(r.from, r.to);
    }

    const idx = await getIndex();
    for (const c of prev) {
      if (nextSlugs.has(c.slug)) continue;
      const n = idx.filter((p) => p.category === c.slug).length;
      if (n > 0) return fail(`'${c.name}' 카테고리에 글이 ${n}개 있어 삭제할 수 없어요. 글을 다른 카테고리로 옮긴 뒤 삭제해 주세요.`);
    }

    await saveCategories(next);
    await purgePages();
    return json({ ok: true, categories: next });
  });
