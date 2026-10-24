import type { APIRoute } from 'astro';
import { handle, json } from '../../../lib/api';
import { getAllPosts, getCategories, getSettings } from '../../../lib/content';
import { store } from '../../../lib/storage';

/**
 * 내보내기용 데이터(글·설정·카테고리 + 이미지 파일 목록).
 * 이미지 바이트는 응답 크기 제한(약 6MB)을 피하려고 브라우저가 /media/... 로 하나씩 받아 zip 으로 묶습니다.
 * (/media 는 CDN 캐시라 함수 호출도 거의 없음)
 */
export const GET: APIRoute = () =>
  handle(async () => {
    const [settings, categories, posts, media] = await Promise.all([getSettings(), getCategories(), getAllPosts(), store('media').list('')]);
    return json({
      ok: true,
      format: 'sudol-blog-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      categories,
      posts,
      media,
    });
  });
