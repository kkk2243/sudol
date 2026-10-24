import type { APIRoute } from 'astro';
import { fail, handle, json, readJson } from '../../../../lib/api';
import { deletePost, getCategories, getPost, savePost, uniqueSlug } from '../../../../lib/content';
import { buildPost } from '../../../../lib/validate';
import { purgePages } from '../../../../lib/cache';

export const GET: APIRoute = ({ params }) =>
  handle(async () => {
    const post = await getPost(params.id ?? '');
    return post ? json({ ok: true, post }) : fail('글을 찾을 수 없어요.', 404);
  });

/** 글 수정 */
export const PUT: APIRoute = ({ params, request }) =>
  handle(async () => {
    const existing = await getPost(params.id ?? '');
    if (!existing) return fail('글을 찾을 수 없어요. 이미 삭제되었을 수 있어요.', 404);
    const raw = await readJson(request, 600_000);
    // 다른 기기에서 먼저 저장한 내용을 덮어쓰지 않도록 확인
    if (raw?.baseUpdatedAt && raw.baseUpdatedAt !== existing.updatedAt && !raw.force) {
      return fail('다른 곳에서 이 글이 먼저 수정되었어요. 새로고침 후 다시 시도하거나, 그래도 저장하려면 "덮어쓰기"를 누르세요.', 409, {
        conflict: true,
      });
    }
    const post = buildPost(raw, existing, await getCategories());
    post.slug = await uniqueSlug(post.slug, post.id);
    await savePost(post);
    // 발행 상태였거나 발행 상태가 되는 경우 공개 페이지 갱신
    if (post.status === 'published' || existing.status === 'published') await purgePages();
    return json({ ok: true, id: post.id, slug: post.slug, updatedAt: post.updatedAt });
  });

export const DELETE: APIRoute = ({ params }) =>
  handle(async () => {
    const id = params.id ?? '';
    const existing = await getPost(id);
    const ok = await deletePost(id);
    if (!ok) return fail('글을 찾을 수 없어요.', 404);
    if (existing?.status === 'published') await purgePages();
    return json({ ok: true });
  });
