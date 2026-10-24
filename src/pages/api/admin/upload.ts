import type { APIRoute } from 'astro';
import { fail, handle, json } from '../../../lib/api';
import { store } from '../../../lib/storage';
import { MAX_EDGE, MAX_UPLOAD_BYTES, VARIANT_WIDTHS, contentTypeForExt, extForType, sniffImageType } from '../../../lib/media';
import { newId } from '../../../lib/util';

/**
 * 이미지 업로드 (브라우저에서 이미 리사이즈·WebP 변환된 파일)
 * 필드: width, height, main(필수), w960, w480(선택)
 * 서버는 실제 바이트로 형식을 다시 확인하고 크기를 제한합니다.
 */
export const POST: APIRoute = ({ request }) =>
  handle(async () => {
    const len = Number(request.headers.get('content-length') || '0');
    if (len > 5.5 * 1024 * 1024) return fail('업로드 용량이 너무 커요(최대 5.5MB).', 413);
    let fd: FormData;
    try {
      fd = await request.formData();
    } catch {
      return fail('업로드 형식이 올바르지 않아요.');
    }
    const width = Number(fd.get('width'));
    const height = Number(fd.get('height'));
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || Math.max(width, height) > MAX_EDGE) {
      return fail(`이미지 크기가 올바르지 않아요(긴 변 최대 ${MAX_EDGE}px).`);
    }

    async function read(name: string): Promise<{ bytes: Uint8Array; type: string } | null> {
      const f = fd.get(name);
      if (!f || typeof f === 'string') return null;
      if (f.size > MAX_UPLOAD_BYTES) throw new Error(`파일이 너무 커요(최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).`);
      const bytes = new Uint8Array(await f.arrayBuffer());
      const type = sniffImageType(bytes);
      if (!type || !extForType(type)) throw new Error('WebP, JPEG, PNG, GIF 이미지만 올릴 수 있어요.');
      return { bytes, type };
    }

    let main: Awaited<ReturnType<typeof read>>;
    try {
      main = await read('main');
    } catch (e) {
      return fail((e as Error).message);
    }
    if (!main) return fail('이미지 파일이 없어요.');
    const ext = extForType(main.type)!;
    const now = new Date(Date.now() + 9 * 3600 * 1000); // KST 기준 폴더
    const folder = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const id = newId();
    const baseName = `${folder}/${id}_${width}x${height}`;
    const media = store('media');

    for (const vw of VARIANT_WIDTHS) {
      if (vw >= width) continue;
      let v: Awaited<ReturnType<typeof read>>;
      try {
        v = await read(`w${vw}`);
      } catch (e) {
        return fail((e as Error).message);
      }
      // 축소본이 없거나 형식이 다르면 원본을 대신 저장(주소 규칙 유지)
      const data = v && extForType(v.type) === ext ? v.bytes : main.bytes;
      await media.setBinary(`${baseName}@${vw}.${ext}`, data, contentTypeForExt(ext));
    }
    await media.setBinary(`${baseName}.${ext}`, main.bytes, contentTypeForExt(ext));
    return json({ ok: true, url: `/media/${baseName}.${ext}`, width, height });
  });
