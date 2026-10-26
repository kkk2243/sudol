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

/** 메뉴 링크 주소: 사이트 안 경로(/...), https://, mailto: 만 허용 */
function menuHref(v: unknown, label: string): string {
  const h = str(v, 300);
  if (!h) throw new HttpError(400, `'${label}' 메뉴의 링크 주소를 입력해 주세요.`);
  if (h.startsWith('/') && !h.startsWith('//')) return h;
  if (/^https?:\/\/[^\s<>"']+$/i.test(h) || /^mailto:[^\s<>"']+$/i.test(h)) return h;
  throw new HttpError(400, `'${label}' 메뉴 주소는 /로 시작하는 사이트 주소나 https:// 주소만 쓸 수 있어요.`);
}

function menuItem(v: any, where: string, allowEmpty = false) {
  const label = str(v?.label, 24);
  if (!label) {
    if (allowEmpty) return { label: '', href: '' };
    throw new HttpError(400, `${where}: 메뉴 이름을 입력해 주세요.`);
  }
  return { label, href: menuHref(v?.href, label), ...(v?.newTab ? { newTab: true } : {}) };
}

function menuList(v: unknown, where: string, max: number) {
  if (!Array.isArray(v)) throw new HttpError(400, `${where} 형식이 올바르지 않아요.`);
  if (v.length > max) throw new HttpError(400, `${where}는 ${max}개까지 만들 수 있어요.`);
  return v.map((x) => menuItem(x, where));
}

/**
 * 설정 저장. raw 에 들어 있는 항목만 바꾸고 나머지는 이전 값을 유지합니다.
 * (블로그 설정 화면과 메뉴·홈 화면 편집 화면이 각자 자기 항목만 보냄)
 */
export function buildSettings(raw: any, prev: Settings): Settings {
  const has = (k: string) => raw && Object.prototype.hasOwnProperty.call(raw, k);
  const s: Settings = { ...prev, adSlots: { ...prev.adSlots } };

  if (has('title')) {
    s.title = str(raw.title, 80);
    if (!s.title) throw new HttpError(400, '블로그 제목을 입력해 주세요.');
  }
  if (has('tagline')) s.tagline = str(raw.tagline, 120);
  if (has('description')) s.description = str(raw.description, 300);
  if (has('authorName')) s.authorName = str(raw.authorName, 30) || prev.authorName;
  if (has('aboutBody') && typeof raw.aboutBody === 'string') s.aboutBody = raw.aboutBody.slice(0, 20000);
  if (has('profileImage')) {
    const v = str(raw.profileImage, 500);
    if (v && !validImageSrc(v)) throw new HttpError(400, '프로필 이미지 주소가 올바르지 않아요.');
    s.profileImage = v;
  }
  if (has('contactEmail')) {
    const v = str(raw.contactEmail, 120);
    if (v && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v)) throw new HttpError(400, '이메일 형식이 올바르지 않아요.');
    s.contactEmail = v;
  }
  if (has('adsenseClient')) {
    const v = str(raw.adsenseClient, 40);
    if (v && !/^ca-pub-\d{10,20}$/.test(v)) throw new HttpError(400, '애드센스 클라이언트 ID는 ca-pub-0000000000000000 형식이에요.');
    s.adsenseClient = v;
  }
  if (has('adSlots')) {
    const slot = (v: unknown) => {
      const x = str(v, 20);
      if (x && !/^\d{6,20}$/.test(x)) throw new HttpError(400, '광고 슬롯 ID는 숫자만 입력해요.');
      return x;
    };
    s.adSlots = {
      top: slot(raw.adSlots?.top),
      middle: slot(raw.adSlots?.middle),
      bottom: slot(raw.adSlots?.bottom),
      sidebar: slot(raw.adSlots?.sidebar),
    };
  }
  if (has('adsTxt')) {
    const v = str(raw.adsTxt, 5000);
    if (/[<>]/.test(v)) throw new HttpError(400, 'ads.txt 내용에 < > 문자는 쓸 수 없어요.');
    s.adsTxt = v;
  }

  // 메뉴·화면 구성
  if (has('logoText')) s.logoText = str(raw.logoText, 30) || prev.logoText;
  if (has('menuHeader')) s.menuHeader = menuList(raw.menuHeader, '헤더 메뉴', 10);
  if (has('menuFooter')) s.menuFooter = menuList(raw.menuFooter, '푸터 메뉴', 12);
  if (has('headerCta')) s.headerCta = menuItem(raw.headerCta, '헤더 버튼', true);
  if (has('heroLabel')) s.heroLabel = str(raw.heroLabel, 30);
  if (has('heroTitle')) s.heroTitle = str(raw.heroTitle, 120) || prev.heroTitle;
  if (has('heroSubtitle')) s.heroSubtitle = str(raw.heroSubtitle, 160);
  if (has('bannerEnabled')) s.bannerEnabled = raw.bannerEnabled === true;
  if (has('bannerLabel')) s.bannerLabel = str(raw.bannerLabel, 30);
  if (has('bannerTitle')) s.bannerTitle = str(raw.bannerTitle, 120);
  if (has('bannerText')) s.bannerText = str(raw.bannerText, 240);
  if (has('bannerPrimary')) s.bannerPrimary = menuItem(raw.bannerPrimary, '배너 첫 번째 버튼', true);
  if (has('bannerSecondary')) s.bannerSecondary = menuItem(raw.bannerSecondary, '배너 두 번째 버튼', true);
  if (has('footerSlogan')) s.footerSlogan = str(raw.footerSlogan, 160);
  return s;
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

