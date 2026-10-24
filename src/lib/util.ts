/** 공용 유틸 (서버·브라우저 양쪽에서 사용 가능한 순수 함수만) */

export const TZ = 'Asia/Seoul';

/** 한글 제목 → URL 슬러그. 한글은 그대로 두고 공백·기호는 하이픈으로. */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFC')
      .toLowerCase()
      .replace(/['"`’“”]/g, '')
      .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80)
      .replace(/-$/g, '') || 'post'
  );
}

export function isValidSlug(s: string): boolean {
  return /^[0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+(?:-[0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+)*$/.test(s) && s.length <= 100;
}

export function isValidCategorySlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 40;
}

export function newId(): string {
  const t = Date.now().toString(36);
  const r = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 8);
  return `${t}${r}`;
}

/** 2026년 10월 24일 */
export function formatDateKo(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(iso),
  );
}

/** 2026.10.24 */
export function formatDateDot(iso: string): string {
  const p = new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}.${p.month}.${p.day}`;
}

/** 2026.10.24 13:05 (KST) */
export function formatDateTimeKo(iso: string): string {
  const p = new Intl.DateTimeFormat('ko-KR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}.${p.month}.${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

/** ISO → datetime-local 입력값(KST 기준) "2026-10-24T13:05" */
export function toKstInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

/** datetime-local 값(KST) → ISO(UTC) */
export function fromKstInput(v: string): string {
  if (!v) return new Date().toISOString();
  return new Date(`${v.length === 16 ? v + ':00' : v}+09:00`).toISOString();
}

/** 마크다운 → 대략적인 평문 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~|]/g, '')
    .replace(/^-{3,}$/gm, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 한국어 기준 분당 약 500자 */
export function readingMinutes(md: string): number {
  const text = stripMarkdown(md);
  const images = (md.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length;
  return Math.max(1, Math.round(text.length / 500 + images * 0.1));
}

export function makeExcerpt(md: string, len = 140): string {
  const t = stripMarkdown(md);
  return t.length > len ? t.slice(0, len - 1).trim() + '…' : t;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function escapeXml(s: string): string {
  return escapeHtml(s);
}

export function normalizeTag(t: string): string {
  return t
    .normalize('NFC')
    .replace(/^#/, '')
    .replace(/[\s,]+/g, '')
    .replace(/[<>"'&/?\\]/g, '')
    .slice(0, 30);
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? Math.trunc(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 허용된 지도 서비스 URL인지 */
export function isAllowedMapUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:') return false;
    return /(^|\.)(naver\.me|naver\.com|kakao\.com|kko\.to|google\.com|goo\.gl|google\.co\.kr|maps\.app\.goo\.gl)$/.test(
      url.hostname,
    );
  } catch {
    return false;
  }
}

export function isHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function mapProviderLabel(u: string): string {
  try {
    const h = new URL(u).hostname;
    if (/naver/.test(h)) return '네이버 지도에서 보기';
    if (/kakao|kko\.to/.test(h)) return '카카오맵에서 보기';
    if (/google|goo\.gl/.test(h)) return '구글 지도에서 보기';
  } catch {}
  return '지도에서 보기';
}
