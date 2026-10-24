/**
 * 업로드 이미지 규칙 (서버·브라우저 공용)
 * - 원본(긴 변 최대 1600px): /media/202610/<id>_<가로>x<세로>.webp
 * - 축소본:                   /media/202610/<id>_<가로>x<세로>@960.webp, @480
 *   (원본 가로가 그 폭보다 클 때만 생성)
 * 파일명에 크기가 들어 있어서 렌더링 시 저장소 조회 없이 width/height/srcset 을 만들 수 있습니다.
 */
export const MAX_EDGE = 1600;
export const VARIANT_WIDTHS = [480, 960] as const;
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 파일 1개당 3MB
export const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/gif'] as const;

const RE = /^\/media\/(\d{6})\/([a-z0-9]+)_(\d{1,5})x(\d{1,5})(?:@(\d{2,4}))?\.(webp|jpg|png|gif)$/;
const KEY_RE = /^(\d{6})\/([a-z0-9]+)_(\d{1,5})x(\d{1,5})(?:@(\d{2,4}))?\.(webp|jpg|png|gif)$/;

export interface ParsedMedia {
  folder: string;
  id: string;
  width: number;
  height: number;
  variant: number | null;
  ext: string;
}

export function parseMediaUrl(src: string): ParsedMedia | null {
  const path = src.split(/[?#]/)[0];
  const m = RE.exec(path);
  if (!m) return null;
  return { folder: m[1], id: m[2], width: +m[3], height: +m[4], variant: m[5] ? +m[5] : null, ext: m[6] };
}

export function isValidMediaKey(key: string): boolean {
  return KEY_RE.test(key);
}

export function mediaUrl(p: ParsedMedia, variant: number | null = null): string {
  return `/media/${p.folder}/${p.id}_${p.width}x${p.height}${variant ? '@' + variant : ''}.${p.ext}`;
}

export interface ImgAttrs {
  src: string;
  width?: number;
  height?: number;
  srcset?: string;
  sizes?: string;
}

/** 이미지 주소로부터 width/height/srcset 계산 */
export function imgAttrs(src: string, sizes = '(min-width: 768px) 680px, 100vw'): ImgAttrs {
  const p = parseMediaUrl(src);
  if (p) {
    const base = { ...p, variant: null };
    const set = VARIANT_WIDTHS.filter((w) => w < p.width).map((w) => `${mediaUrl(base, w)} ${w}w`);
    set.push(`${mediaUrl(base)} ${p.width}w`);
    return { src: mediaUrl(base), width: p.width, height: p.height, srcset: set.join(', '), sizes };
  }
  // 샘플 플레이스홀더 SVG
  if (src.startsWith('/placeholders/')) return { src, width: 1600, height: 1000 };
  return { src };
}

export function contentTypeForExt(ext: string): string {
  return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
}

export function extForType(t: string): string | null {
  if (t === 'image/webp') return 'webp';
  if (t === 'image/jpeg') return 'jpg';
  if (t === 'image/png') return 'png';
  if (t === 'image/gif') return 'gif';
  return null;
}

/** 파일 앞부분 바이트로 실제 형식 확인 (확장자/Content-Type 위조 방지) */
export function sniffImageType(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  return null;
}
