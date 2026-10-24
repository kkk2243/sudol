/**
 * 브라우저에서 업로드 전 이미지 처리
 * - 긴 변 최대 1600px 로 축소, WebP 로 변환(WebP 인코딩을 못 하는 브라우저는 JPEG)
 * - srcset 용 축소본(960, 480px)도 함께 생성
 * - 사진의 EXIF 회전 정보는 createImageBitmap 이 반영, 위치정보 등 메타데이터는 캔버스 재인코딩으로 제거됨
 */
import { MAX_EDGE, MAX_UPLOAD_BYTES, VARIANT_WIDTHS } from '../lib/media';
import { api } from './client';

export interface UploadResult {
  url: string;
  width: number;
  height: number;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    // 일부 브라우저 대비: <img> 로 디코딩
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error(`'${file.name}' 이미지를 읽을 수 없어요. (HEIC 등은 JPG로 바꿔서 올려주세요)`);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((r) => canvas.toBlob(r, type, q));
}

async function encode(src: CanvasImageSource, sw: number, sh: number, w: number, h: number, preferWebp: boolean): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; // 투명 PNG → JPEG 대비 흰 배경
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
  if (preferWebp) {
    for (const q of [0.82, 0.72, 0.6]) {
      const b = await toBlob(c, 'image/webp', q);
      if (b && b.type === 'image/webp' && b.size <= MAX_UPLOAD_BYTES) return b;
      if (b && b.type !== 'image/webp') break; // WebP 미지원 → JPEG
    }
  }
  for (const q of [0.85, 0.75, 0.6]) {
    const b = await toBlob(c, 'image/jpeg', q);
    if (b && b.size <= MAX_UPLOAD_BYTES) return b;
  }
  throw new Error('이미지를 충분히 작게 줄이지 못했어요.');
}

export async function processAndUpload(file: File, onProgress?: (msg: string) => void): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) throw new Error(`'${file.name}'은(는) 이미지 파일이 아니에요.`);
  if (file.size > 40 * 1024 * 1024) throw new Error(`'${file.name}' 파일이 너무 커요(40MB 초과).`);
  onProgress?.('이미지 줄이는 중…');
  const bmp = await decode(file);
  const sw = 'naturalWidth' in bmp ? bmp.naturalWidth : bmp.width;
  const sh = 'naturalHeight' in bmp ? bmp.naturalHeight : bmp.height;
  if (!sw || !sh) throw new Error('이미지 크기를 알 수 없어요.');
  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const main = await encode(bmp, sw, sh, w, h, true);
  const isWebp = main.type === 'image/webp';
  const fd = new FormData();
  fd.append('width', String(w));
  fd.append('height', String(h));
  fd.append('main', main, isWebp ? 'main.webp' : 'main.jpg');
  for (const vw of VARIANT_WIDTHS) {
    if (vw >= w) continue;
    const vh = Math.max(1, Math.round((h * vw) / w));
    const b = await encode(bmp, sw, sh, vw, vh, isWebp);
    fd.append(`w${vw}`, b, `w${vw}.${isWebp ? 'webp' : 'jpg'}`);
  }
  if ('close' in bmp) bmp.close();

  onProgress?.('업로드 중…');
  const r = await api<{ ok: true; url: string; width: number; height: number }>('/api/admin/upload', { method: 'POST', body: fd });
  return { url: r.url, width: r.width, height: r.height };
}
