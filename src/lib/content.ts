/**
 * 콘텐츠 저장/조회 계층.
 * 저장 구조(content 저장소):
 *   meta/settings.json     블로그 설정
 *   meta/categories.json   카테고리 목록
 *   meta/index.json        모든 글의 요약 인덱스(목록·검색·사이트맵용, 본문 제외)
 *   posts/<id>.json        글 전체
 * 목록 페이지는 인덱스 파일 1개만 읽으므로 Blobs 호출이 적습니다.
 */
import { store } from './storage';
import type { Category, Post, PostSummary, Settings } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, SAMPLE_POSTS } from './seed';
import { makeExcerpt, readingMinutes, stripMarkdown } from './util';

const K = {
  settings: 'meta/settings.json',
  categories: 'meta/categories.json',
  index: 'meta/index.json',
  init: 'meta/initialized.json',
  post: (id: string) => `posts/${id}.json`,
};

const db = () => store('content');

let initPromise: Promise<void> | null = null;

/** 최초 실행 시 기본 설정·카테고리·샘플 글 생성 */
export function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const done = await db().getJSON<{ at: string }>(K.init);
      if (done) return;
      await db().setJSON(K.settings, DEFAULT_SETTINGS);
      await db().setJSON(K.categories, DEFAULT_CATEGORIES);
      for (const p of SAMPLE_POSTS) await db().setJSON(K.post(p.id), p);
      await db().setJSON(K.index, SAMPLE_POSTS.map(toSummary));
      await db().setJSON(K.init, { at: new Date().toISOString() });
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

export function toSummary(p: Post): PostSummary {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt || makeExcerpt(p.body),
    category: p.category,
    tags: p.tags,
    cover: p.cover ?? null,
    status: p.status,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    readingMinutes: readingMinutes(p.body),
    placeName: p.place?.name || undefined,
    placeRegion: p.place?.region || undefined,
    sample: p.sample || undefined,
    searchText: stripMarkdown(p.body).slice(0, 2000),
  };
}

/* ───────── 설정 / 카테고리 ───────── */

export async function getSettings(): Promise<Settings> {
  await ensureInitialized();
  const s = await db().getJSON<Partial<Settings>>(K.settings);
  // 예전 버전에서 저장된 설정에도 새 항목(메뉴 등)이 기본값으로 채워지도록 병합
  return { ...DEFAULT_SETTINGS, ...(s || {}), adSlots: { ...DEFAULT_SETTINGS.adSlots, ...(s?.adSlots || {}) } };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db().setJSON(K.settings, s);
}

export async function getCategories(): Promise<Category[]> {
  await ensureInitialized();
  return (await db().getJSON<Category[]>(K.categories)) || DEFAULT_CATEGORIES;
}

export async function saveCategories(list: Category[]): Promise<void> {
  await db().setJSON(K.categories, list);
}

/* ───────── 글 인덱스 ───────── */

export async function getIndex(): Promise<PostSummary[]> {
  await ensureInitialized();
  return (await db().getJSON<PostSummary[]>(K.index)) || [];
}

async function writeIndex(list: PostSummary[]): Promise<void> {
  list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  await db().setJSON(K.index, list);
}

export function isLive(p: Pick<PostSummary, 'status' | 'publishedAt'>, now = Date.now()): boolean {
  return p.status === 'published' && new Date(p.publishedAt).getTime() <= now;
}

/** 공개된 글(발행 상태 + 발행일이 지난 글), 최신순 */
export async function getPublished(now = Date.now()): Promise<PostSummary[]> {
  return (await getIndex()).filter((p) => isLive(p, now));
}

/* ───────── 글 ───────── */

export async function getPost(id: string): Promise<Post | null> {
  if (!/^[a-z0-9]{4,40}$/.test(id)) return null;
  await ensureInitialized();
  return db().getJSON<Post>(K.post(id));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const s = (await getIndex()).find((p) => p.slug === slug);
  return s ? getPost(s.id) : null;
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  return (await getIndex()).some((p) => p.slug === slug && p.id !== exceptId);
}

/** 슬러그가 겹치면 -2, -3… 을 붙여 비어 있는 슬러그 반환 */
export async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const idx = await getIndex();
  const taken = new Set(idx.filter((p) => p.id !== exceptId).map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now().toString(36)}`;
}

export async function savePost(p: Post): Promise<void> {
  await db().setJSON(K.post(p.id), p);
  const idx = (await getIndex()).filter((x) => x.id !== p.id);
  idx.push(toSummary(p));
  await writeIndex(idx);
}

export async function deletePost(id: string): Promise<boolean> {
  const idx = await getIndex();
  if (!idx.some((p) => p.id === id)) return false;
  await db().delete(K.post(id));
  await writeIndex(idx.filter((p) => p.id !== id));
  return true;
}

export async function deleteSamples(): Promise<number> {
  const idx = await getIndex();
  const samples = idx.filter((p) => p.sample);
  for (const p of samples) await db().delete(K.post(p.id));
  await writeIndex(idx.filter((p) => !p.sample));
  return samples.length;
}

/** 모든 글 전체 데이터(내보내기용) */
export async function getAllPosts(): Promise<Post[]> {
  const idx = await getIndex();
  const out: Post[] = [];
  for (const s of idx) {
    const p = await getPost(s.id);
    if (p) out.push(p);
  }
  return out;
}

/** 가져오기: 같은 id 는 덮어쓰기 */
export async function importPosts(posts: Post[]): Promise<number> {
  const idx = await getIndex();
  const map = new Map(idx.map((s) => [s.id, s]));
  for (const p of posts) {
    await db().setJSON(K.post(p.id), p);
    map.set(p.id, toSummary(p));
  }
  await writeIndex([...map.values()]);
  return posts.length;
}

/* ───────── 태그 ───────── */

export interface TagCount {
  name: string;
  count: number;
}

export function countTags(list: PostSummary[]): TagCount[] {
  const m = new Map<string, number>();
  for (const p of list) for (const t of p.tags) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
}

/** 태그 이름 변경(to 가 빈 문자열이면 삭제). 변경된 글 수 반환 */
export async function renameTag(from: string, to: string): Promise<number> {
  const idx = await getIndex();
  let n = 0;
  for (const s of idx) {
    if (!s.tags.includes(from)) continue;
    const p = await getPost(s.id);
    if (!p) continue;
    const tags = p.tags.filter((t) => t !== from);
    if (to && !tags.includes(to)) tags.push(to);
    p.tags = tags;
    await db().setJSON(K.post(p.id), p);
    Object.assign(s, toSummary(p));
    n++;
  }
  await writeIndex(idx);
  return n;
}

/** 카테고리 slug 변경 시 글들의 카테고리도 옮기기 */
export async function moveCategory(from: string, to: string): Promise<number> {
  const idx = await getIndex();
  let n = 0;
  for (const s of idx) {
    if (s.category !== from) continue;
    const p = await getPost(s.id);
    if (!p) continue;
    p.category = to;
    await db().setJSON(K.post(p.id), p);
    Object.assign(s, toSummary(p));
    n++;
  }
  await writeIndex(idx);
  return n;
}

/* ───────── 관련 글 / 이전·다음 ───────── */

export function relatedPosts(all: PostSummary[], current: PostSummary, limit = 3): PostSummary[] {
  return all
    .filter((p) => p.id !== current.id)
    .map((p) => ({
      p,
      score: (p.category === current.category ? 2 : 0) + p.tags.filter((t) => current.tags.includes(t)).length * 3,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.publishedAt.localeCompare(a.p.publishedAt))
    .slice(0, limit)
    .map((x) => x.p);
}

export function prevNext(all: PostSummary[], current: PostSummary): { prev?: PostSummary; next?: PostSummary } {
  // all 은 최신순. prev = 더 오래된 글, next = 더 최신 글
  const i = all.findIndex((p) => p.id === current.id);
  if (i < 0) return {};
  return { next: all[i - 1], prev: all[i + 1] };
}

/* ───────── 검색 ───────── */

export function searchPosts(all: PostSummary[], q: string): PostSummary[] {
  const terms = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!terms.length) return [];
  const scored = all
    .map((p) => {
      const title = p.title.toLowerCase();
      const meta = [p.excerpt, p.placeName, p.placeRegion, ...p.tags].join(' ').toLowerCase();
      const body = p.searchText.toLowerCase();
      let score = 0;
      for (const t of terms) {
        const s = (title.includes(t) ? 5 : 0) + (meta.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0);
        if (!s) return { p, score: 0 };
        score += s;
      }
      return { p, score };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || b.p.publishedAt.localeCompare(a.p.publishedAt));
  return scored.map((x) => x.p);
}
