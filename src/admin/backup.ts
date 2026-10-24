/**
 * 백업 내보내기/가져오기 (브라우저에서 실행)
 * - JSON: 글·설정·카테고리 + 이미지(base64)를 파일 하나에
 * - 마크다운 zip: posts/<슬러그>.md (머리말 포함) + media/<키> 이미지 + site.json
 * 서버 응답 크기 제한을 피하려고 이미지는 /media/... 에서 하나씩 받고, 가져올 때도 하나씩 올립니다.
 */
import JSZip from 'jszip';
import type { Category, Post, Settings } from '../lib/types';
import { api, csrfToken } from './client';

interface Manifest {
  format: 'sudol-blog-backup';
  version: number;
  exportedAt: string;
  settings: Settings;
  categories: Category[];
  posts: Post[];
  media: string[];
}

type Progress = (msg: string) => void;

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const stamp = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '');

async function fetchMedia(keys: string[], progress: Progress): Promise<Map<string, ArrayBuffer>> {
  const out = new Map<string, ArrayBuffer>();
  let i = 0;
  for (const k of keys) {
    progress(`이미지 받는 중 ${++i}/${keys.length}`);
    const r = await fetch(`/media/${k}`);
    if (r.ok) out.set(k, await r.arrayBuffer());
  }
  return out;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function exportJson(withImages: boolean, progress: Progress) {
  progress('글 목록 받는 중…');
  const m = await api<Manifest>('/api/admin/export');
  const media: Record<string, string> = {};
  if (withImages) {
    const files = await fetchMedia(m.media, progress);
    for (const [k, v] of files) media[k] = toBase64(v);
  }
  const data = { format: m.format, version: m.version, exportedAt: m.exportedAt, settings: m.settings, categories: m.categories, posts: m.posts, media };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `sudol-blog-backup-${stamp()}.json`);
  progress(`완료: 글 ${m.posts.length}개, 이미지 ${Object.keys(media).length}개`);
}

/* ── 마크다운 머리말: 값은 JSON 형식(= 유효한 YAML)으로 기록 ── */
const FM_KEYS = ['id', 'title', 'slug', 'category', 'tags', 'status', 'publishedAt', 'createdAt', 'updatedAt', 'excerpt', 'cover', 'place', 'sample'] as const;

function toMarkdown(p: Post): string {
  const lines = FM_KEYS.filter((k) => p[k] !== undefined && p[k] !== null).map((k) => `${k}: ${JSON.stringify(p[k])}`);
  return `---\n${lines.join('\n')}\n---\n\n${p.body}`;
}

function fromMarkdown(text: string): Post {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) throw new Error('머리말(---)이 없는 마크다운 파일이에요.');
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    try {
      meta[key] = JSON.parse(raw);
    } catch {
      meta[key] = raw.replace(/^['"]|['"]$/g, '');
    }
  }
  return { ...(meta as unknown as Post), body: text.slice(m[0].length).replace(/^\n/, '') };
}

export async function exportMarkdownZip(progress: Progress) {
  progress('글 목록 받는 중…');
  const m = await api<Manifest>('/api/admin/export');
  const zip = new JSZip();
  zip.file('site.json', JSON.stringify({ format: m.format, version: m.version, exportedAt: m.exportedAt, settings: m.settings, categories: m.categories }, null, 2));
  zip.file(
    'README.txt',
    '수돌이 블로그 백업\n- posts/: 글(마크다운, 맨 위 --- 사이는 글 정보)\n- media/: 이미지 (본문의 /media/... 주소와 같은 경로)\n- site.json: 블로그 설정·카테고리\n관리자 → 데이터 관리 → 가져오기에서 이 zip을 그대로 올리면 복원됩니다.\n',
  );
  const used = new Set<string>();
  for (const p of m.posts) {
    let name = p.slug;
    if (used.has(name)) name = `${p.slug}-${p.id}`;
    used.add(name);
    zip.file(`posts/${name}.md`, toMarkdown(p));
  }
  const files = await fetchMedia(m.media, progress);
  for (const [k, v] of files) zip.file(`media/${k}`, v);
  progress('압축하는 중…');
  const blob = await zip.generateAsync({ type: 'blob' }, (meta) => progress(`압축하는 중… ${Math.round(meta.percent)}%`));
  download(blob, `sudol-blog-markdown-${stamp()}.zip`);
  progress(`완료: 글 ${m.posts.length}개, 이미지 ${files.size}개`);
}

/* ── 가져오기 ── */
async function putMedia(key: string, data: Uint8Array | ArrayBuffer) {
  const r = await fetch(`/api/admin/media?key=${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'x-csrf-token': csrfToken(), 'content-type': 'application/octet-stream' },
    body: data as BodyInit,
    credentials: 'same-origin',
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`이미지 ${key}: ${d.error || r.status}`);
  }
}

async function sendPosts(posts: Post[], meta: { settings?: Settings; categories?: Category[] }, progress: Progress) {
  // 설정·카테고리 먼저 (글의 카테고리 검증에 필요)
  if (meta.categories || meta.settings) await api('/api/admin/import', { method: 'POST', json: { categories: meta.categories, settings: meta.settings } });
  const CHUNK = 20;
  for (let i = 0; i < posts.length; i += CHUNK) {
    progress(`글 올리는 중 ${Math.min(i + CHUNK, posts.length)}/${posts.length}`);
    await api('/api/admin/import', { method: 'POST', json: { posts: posts.slice(i, i + CHUNK) } });
  }
  await api('/api/admin/import', { method: 'POST', json: { done: true } });
}

export async function importFile(file: File, progress: Progress): Promise<string> {
  const errors: string[] = [];
  if (/\.json$/i.test(file.name)) {
    progress('파일 읽는 중…');
    const data = JSON.parse(await file.text());
    if (data?.format !== 'sudol-blog-backup') throw new Error('이 블로그에서 내보낸 JSON 백업 파일이 아니에요.');
    const keys = Object.keys(data.media || {});
    let i = 0;
    for (const k of keys) {
      progress(`이미지 올리는 중 ${++i}/${keys.length}`);
      try {
        await putMedia(k, fromBase64(data.media[k]));
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    await sendPosts(data.posts || [], { settings: data.settings, categories: data.categories }, progress);
    return `글 ${data.posts?.length ?? 0}개, 이미지 ${keys.length - errors.length}개를 가져왔어요.` + (errors.length ? ` (실패 ${errors.length}건)` : '');
  }
  if (/\.zip$/i.test(file.name)) {
    progress('압축 푸는 중…');
    const zip = await JSZip.loadAsync(file);
    const site = zip.file('site.json') ? JSON.parse(await zip.file('site.json')!.async('string')) : {};
    const mediaFiles = zip.file(/^media\/.+/);
    let i = 0;
    for (const f of mediaFiles) {
      progress(`이미지 올리는 중 ${++i}/${mediaFiles.length}`);
      try {
        await putMedia(f.name.replace(/^media\//, ''), await f.async('uint8array'));
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    const posts: Post[] = [];
    for (const f of zip.file(/^posts\/.+\.md$/)) {
      try {
        posts.push(fromMarkdown(await f.async('string')));
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    await sendPosts(posts, { settings: site.settings, categories: site.categories }, progress);
    return `글 ${posts.length}개, 이미지 ${mediaFiles.length - errors.filter((x) => x.startsWith('이미지')).length}개를 가져왔어요.` + (errors.length ? ` (실패 ${errors.length}건)` : '');
  }
  throw new Error('.json 또는 .zip 파일을 선택해 주세요.');
}
