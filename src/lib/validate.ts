/** 서버측 입력 검증: 브라우저에서 무엇을 보내든 여기서 정리·제한합니다. */
import { HttpError, str } from './api';
import type { Category, CoverImage, PlaceInfo, Post, PostStatus, Settings } from './types';
import { isAllowedMapUrl, isValidCategorySlug, isValidSlug, makeExcerpt, newId, normalizeTag, slugify } from './util';
import { parseMediaUrl } from './media';

const MAX_BODY = 200_000; // 마크다운 20만 자

function validImageSrc(src: string): boolean {
  if (!src) return false;
  if (parseMediaUrl(src)) return true;
  if (/^\/placeholders\/[a-z0-9-]+\.svg$/.test(src)) return true;
  return /^https:\/\//.test(src) && src.length < 500;
}

function cover(v: any): CoverImage | null {
  if (!v || typeof v !== 'object') return null;
  const src = str(v.src, 500);
  if (!validImageSrc(src)) return null;
  return { src, alt: str(v.alt, 200) };
}

function place(v: any): PlaceInfo | null {
  if (!v || typeof v !== 'object') return null;
  const mapUrl = str(v.mapUrl, 500);
  if (mapUrl && !isAllowedMapUrl(mapUrl)) throw new HttpError(400, '지도 링크는 네이버·카카오·구글 지도의 https 주소만 넣을 수 있어요.');
  const rating = Number(v.rating);
  const visitedAt = str(v.visitedAt, 10);
  const p: PlaceInfo = {
    name: str(v.name, 80) || undefined,
    region: str(v.region, 40) || undefined,
    address: str(v.address, 200) || undefined,
    mapUrl: mapUrl || undefined,
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : undefined,
    priceRange: str(v.priceRange, 60) || undefined,
    visitedAt: /^\d{4}-\d{2}-\d{2}$/.test(visitedAt) ? visitedAt : undefined,
  };
  return Object.values(p).some(Boolean) ? p : null;
}

export function parseDate(v: unknown, fallback: string): string {
  if (typeof v !== 'string' || !v) return fallback;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, '발행일 형식이 올바르지 않아요.');
  return d.toISOString();
}

/** 글 입력값 → 저장할 Post (슬러그 중복은 호출 측에서 처리) */
export function buildPost(raw: any, existing: Post | null, categories: Category[]): Post {
  const now = new Date().toISOString();
  const title = str(raw?.title, 150);
  if (!title) throw new HttpError(400, '제목을 입력해 주세요.');
  const body = typeof raw?.body === 'string' ? raw.body.slice(0, MAX_BODY) : '';
  const status: PostStatus = raw?.status === 'published' ? 'published' : 'draft';
  if (status === 'published' && !body.trim()) throw new HttpError(400, '본문이 비어 있으면 발행할 수 없어요.');

  let slug = str(raw?.slug, 100).toLowerCase().normalize('NFC');
  if (!slug) slug = slugify(title);
  if (!isValidSlug(slug)) throw new HttpError(400, '슬러그는 한글, 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있어요.');

  const category = str(raw?.category, 40);
  if (!categories.some((c) => c.slug === category)) throw new HttpError(400, '카테고리를 선택해 주세요.');

  const tagsIn: unknown[] = Array.isArray(raw?.tags) ? raw.tags : typeof raw?.tags === 'string' ? raw.tags.split(',') : [];
  const tags = [...new Set(tagsIn.map((t) => normalizeTag(String(t))).filter(Boolean))].slice(0, 15);

  const excerpt = str(raw?.excerpt, 300) || makeExcerpt(body);

  return {
    id: existing?.id ?? newId(),
    slug,
    title,
    excerpt,
    body,
    category,
    tags,
    cover: cover(raw?.cover),
    status,
    publishedAt: parseDate(raw?.publishedAt, existing?.publishedAt ?? now),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    place: place(raw?.place),
    sample: existing?.sample && raw?.keepSample !== false ? existing.sample : undefined,
  };
}

export function buildCategories(raw: any): Category[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, '카테고리는 최소 1개가 필요해요.');
  if (raw.length > 30) throw new HttpError(400, '카테고리는 30개까지 만들 수 있어요.');
  const seen = new Set<string>();
  return raw.map((c: any) => {
    const slug = str(c?.slug, 40).toLowerCase();
    const name = str(c?.name, 20);
    if (!name) throw new HttpError(400, '카테고리 이름을 입력해 주세요.');
    if (!isValidCategorySlug(slug)) throw new HttpError(400, `'${name}'의 주소(slug)는 영문 소문자, 숫자, 하이픈만 쓸 수 있어요.`);
    if (seen.has(slug)) throw new HttpError(400, `주소 '${slug}'가 중복돼요.`);
    seen.add(slug);
    return { slug, name, emoji: str(c?.emoji, 8), description: str(c?.description, 120) };
  });
}

export function buildSettings(raw: any, prev: Settings): Settings {
  const client = str(raw?.adsenseClient, 40);
  if (client && !/^ca-pub-\d{10,20}$/.test(client)) throw new HttpError(400, '애드센스 클라이언트 ID는 ca-pub-0000000000000000 형식이에요.');
  const email = str(raw?.contactEmail, 120);
  if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) throw new HttpError(400, '이메일 형식이 올바르지 않아요.');
  const profileImage = str(raw?.profileImage, 500);
  if (profileImage && !validImageSrc(profileImage)) throw new HttpError(400, '프로필 이미지 주소가 올바르지 않아요.');
  const slot = (v: unknown) => {
    const s = str(v, 20);
    if (s && !/^\d{6,20}$/.test(s)) throw new HttpError(400, '광고 슬롯 ID는 숫자만 입력해요.');
    return s;
  };
  const adsTxt = str(raw?.adsTxt, 5000);
  if (/[<>]/.test(adsTxt)) throw new HttpError(400, 'ads.txt 내용에 < > 문자는 쓸 수 없어요.');
  const title = str(raw?.title, 80);
  if (!title) throw new HttpError(400, '블로그 제목을 입력해 주세요.');
  return {
    title,
    tagline: str(raw?.tagline, 120),
    description: str(raw?.description, 300),
    authorName: str(raw?.authorName, 30) || prev.authorName,
    aboutBody: typeof raw?.aboutBody === 'string' ? raw.aboutBody.slice(0, 20000) : prev.aboutBody,
    profileImage,
    contactEmail: email,
    adsenseClient: client,
    adSlots: {
      top: slot(raw?.adSlots?.top),
      middle: slot(raw?.adSlots?.middle),
      bottom: slot(raw?.adSlots?.bottom),
      sidebar: slot(raw?.adSlots?.sidebar),
    },
    adsTxt,
  };
}

/** 가져오기용: 저장 형식 그대로의 글 검증 (id·날짜 유지) */
export function sanitizeImportedPost(raw: any, categories: Category[]): Post {
  const id = str(raw?.id, 40);
  if (!/^[a-z0-9]{4,40}$/.test(id)) throw new HttpError(400, `잘못된 글 id: ${id}`);
  const fallbackCat = categories[0]?.slug ?? 'daily';
  const cat = categories.some((c) => c.slug === raw?.category) ? raw.category : fallbackCat;
  const base = buildPost({ ...raw, category: cat }, null, categories);
  const now = new Date().toISOString();
  return {
    ...base,
    id,
    createdAt: parseDate(raw?.createdAt, now),
    updatedAt: parseDate(raw?.updatedAt, now),
    publishedAt: parseDate(raw?.publishedAt, now),
    sample: raw?.sample === true ? true : undefined,
  };
}

