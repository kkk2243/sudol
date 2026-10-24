/**
 * CDN 캐시 전략 (Netlify 크레딧 절약의 핵심)
 * - 공개 페이지: 브라우저는 매번 재검증, Netlify CDN은 최대 1년 보관(durable 캐시 → 모든 엣지가 공유)
 *   → 같은 페이지는 사실상 처음 1번만 함수가 실행됩니다.
 * - 글 발행·수정·삭제·설정 변경 시 PAGE_TAG 를 퍼지해서 모든 공개 페이지를 한 번에 갱신.
 *   (1인 블로그는 글 하나가 홈·목록·태그·사이트맵·RSS·관련글에 모두 영향을 주므로 전체 퍼지가 단순하고 정확합니다)
 * - 예약 발행 글이 있으면 그 시각까지만 캐시해서 제때 노출되도록 합니다.
 * - 이미지(/media): 파일명이 바뀌지 않으므로 영구 캐시.
 */
import { purgeCache } from '@netlify/functions';
import type { PostSummary } from './types';

export const PAGE_TAG = 'sudol-pages';
export const MEDIA_TAG = 'sudol-media';
const YEAR = 31536000;

export interface CacheOptions {
  /** 캐시 키에 포함할 쿼리 파라미터(그 외 utm_* 등은 무시해서 캐시 조각화 방지) */
  query?: string[];
  /** CDN 보관 시간 상한(초) */
  maxSeconds?: number;
  /** 글 인덱스(예약 발행 시각 계산용) */
  index?: PostSummary[];
}

/** 예약 발행 글 중 가장 이른 발행 시각(ms) */
export function nextScheduledFrom(index: PostSummary[], now = Date.now()): number | null {
  let next: number | null = null;
  for (const p of index) {
    if (p.status !== 'published') continue;
    const t = new Date(p.publishedAt).getTime();
    if (t > now && (next === null || t < next)) next = t;
  }
  return next;
}

export function setPublicCache(headers: Headers, opts: CacheOptions = {}): void {
  let sMax = opts.maxSeconds ?? YEAR;
  const next = opts.index ? nextScheduledFrom(opts.index) : null;
  if (next) sMax = Math.max(60, Math.min(sMax, Math.ceil((next - Date.now()) / 1000)));
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('Netlify-CDN-Cache-Control', `public, durable, s-maxage=${sMax}, stale-while-revalidate=120`);
  headers.set('Netlify-Cache-Tag', PAGE_TAG);
  headers.set('Netlify-Vary', `query=${(opts.query?.length ? opts.query : ['_']).join('|')}`);
}

export function setNoStore(headers: Headers): void {
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Netlify-CDN-Cache-Control', 'no-store');
}

export function setMediaCache(headers: Headers): void {
  headers.set('Cache-Control', `public, max-age=${YEAR}, immutable`);
  headers.set('Netlify-CDN-Cache-Control', `public, durable, max-age=${YEAR}, immutable`);
  headers.set('Netlify-Cache-Tag', MEDIA_TAG);
  headers.set('Netlify-Vary', 'query=_');
}

/** 공개 페이지 캐시 전체 무효화. 로컬 개발에서는 아무 일도 하지 않음 */
export async function purgePages(): Promise<void> {
  if (import.meta.env.DEV) return;
  try {
    await purgeCache({ tags: [PAGE_TAG] });
  } catch (e) {
    console.error('[cache] 퍼지 실패:', e);
  }
}
