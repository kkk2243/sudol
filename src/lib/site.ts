/**
 * 요청 1번 안에서 설정·카테고리·인덱스를 한 번만 읽도록 Astro.locals 에 메모.
 * (함수 인스턴스 간 전역 캐시는 쓰지 않음 → 관리자 저장 직후 오래된 데이터로 CDN에 캐시되는 일 방지)
 */
import { getCategories, getIndex, getSettings, isLive } from './content';
import type { Category, PostSummary, Settings } from './types';

export interface SiteData {
  settings: Settings;
  categories: Category[];
  index: PostSummary[];
  /** 공개된 글(최신순) */
  published: PostSummary[];
  categoryMap: Map<string, Category>;
}

export function siteData(locals: App.Locals): Promise<SiteData> {
  const l = locals as App.Locals & { __site?: Promise<SiteData> };
  if (!l.__site) {
    l.__site = Promise.all([getSettings(), getCategories(), getIndex()]).then(([settings, categories, index]) => {
      const now = Date.now();
      return {
        settings,
        categories,
        index,
        published: index.filter((p) => isLive(p, now)),
        categoryMap: new Map(categories.map((c) => [c.slug, c])),
      };
    });
  }
  return l.__site;
}

export const PAGE_SIZE = 12;

export function paginate<T>(list: T[], pageParam: string | null, size = PAGE_SIZE) {
  const total = Math.max(1, Math.ceil(list.length / size));
  const n = Number.parseInt(pageParam || '1', 10);
  const page = Number.isFinite(n) && n >= 1 ? n : 1;
  return {
    page,
    total,
    items: list.slice((page - 1) * size, page * size),
    outOfRange: page > total,
  };
}
