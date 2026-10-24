/** 글 작성/수정 화면 스크립트 */
import DOMPurify from 'dompurify';
import { renderMarkdown, youtubeId } from '../lib/markdown/render';
import { ALLOWED_ATTR, ALLOWED_TAGS } from '../lib/markdown/sanitize-config';
import { fromKstInput, slugify, toKstInput, isValidSlug } from '../lib/util';
import type { Post } from '../lib/types';
import { api, ApiError, confirmDialog, errMsg, toast, withBusy } from './client';
import { processAndUpload } from './image';
import { mediaUrl, parseMediaUrl } from '../lib/media';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const initial = JSON.parse($('#post-data').textContent || '{}') as { post: Post | null };
let postId: string | null = initial.post?.id ?? null;
let baseUpdatedAt: string | null = initial.post?.updatedAt ?? null;
let currentStatus: 'draft' | 'published' = initial.post?.status ?? 'draft';
let slugManual = !!initial.post;
let dirty = false;
let saving = false;

const f = {
  title: $<HTMLInputElement>('#f-title'),
  body: $<HTMLTextAreaElement>('#f-body'),
  slug: $<HTMLInputElement>('#f-slug'),
  category: $<HTMLSelectElement>('#f-category'),
  tags: $<HTMLInputElement>('#f-tags'),
  date: $<HTMLInputElement>('#f-date'),
  excerpt: $<HTMLTextAreaElement>('#f-excerpt'),
  coverAlt: $<HTMLInputElement>('#f-cover-alt'),
  pName: $<HTMLInputElement>('#p-name'),
  pRegion: $<HTMLInputElement>('#p-region'),
  pAddress: $<HTMLInputElement>('#p-address'),
  pMap: $<HTMLInputElement>('#p-map'),
  pPrice: $<HTMLInputElement>('#p-price'),
  pVisited: $<HTMLInputElement>('#p-visited'),
};
let coverSrc: string = initial.post?.cover?.src ?? '';

/* ───────── 미리보기 ───────── */
const ALL_ATTRS = [...new Set(Object.values(ALLOWED_ATTR).flat())];
const sanitize = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ALL_ATTRS, ALLOW_DATA_ATTR: true }) as unknown as string;
const preview = $('#preview');
let previewTimer = 0;
function renderPreview() {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    const md = f.body.value;
    preview.innerHTML = md.trim() ? renderMarkdown(md, sanitize).html : '<p style="color:var(--ink-3)">미리보기가 여기에 보여요.</p>';
  }, 120);
}

/* ───────── 상태 표시 / 로컬 백업 ───────── */
const saveState = $('#save-state');
const backupKey = () => `sudol-draft:${postId ?? 'new'}`;
let backupTimer = 0;
function markDirty() {
  dirty = true;
  saveState.textContent = '저장 안 된 변경사항';
  clearTimeout(backupTimer);
  backupTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(backupKey(), JSON.stringify({ savedAt: new Date().toISOString(), data: collect('draft') }));
    } catch {}
  }, 800);
}
function clearBackup(key = backupKey()) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/* ───────── 슬러그 ───────── */
const slugHint = $('#slug-hint');
function updateSlugHint() {
  const s = f.slug.value.trim() || slugify(f.title.value || '');
  slugHint.textContent = `/post/${s || '…'}`;
  f.slug.setAttribute('aria-invalid', f.slug.value && !isValidSlug(f.slug.value.trim()) ? 'true' : 'false');
}
f.title.addEventListener('input', () => {
  if (!slugManual) f.slug.value = slugify(f.title.value);
  updateSlugHint();
});
f.slug.addEventListener('input', () => {
  slugManual = f.slug.value.trim() !== '';
  updateSlugHint();
});
f.slug.addEventListener('blur', () => {
  if (f.slug.value.trim()) f.slug.value = slugify(f.slug.value);
  updateSlugHint();
});

/* ───────── 발행일 ───────── */
const publishBtn = $<HTMLButtonElement>('#publish-btn');
const dateHint = $('#date-hint');
function updateDateUi() {
  const v = f.date.value;
  const future = v && new Date(fromKstInput(v)).getTime() > Date.now() + 60_000;
  if (future) {
    dateHint.textContent = `예약 발행: 이 시각에 자동으로 공개돼요.`;
    publishBtn.textContent = currentStatus === 'published' ? '예약 업데이트' : '예약 발행';
  } else {
    dateHint.textContent = '비워두면 저장하는 순간으로 정해져요. 미래 시각이면 그때 자동 공개돼요.';
    publishBtn.textContent = currentStatus === 'published' ? '업데이트' : '발행하기';
  }
}
f.date.addEventListener('change', updateDateUi);
$('[data-now]').addEventListener('click', () => {
  f.date.value = toKstInput(new Date().toISOString());
  updateDateUi();
  markDirty();
});

/* ───────── 요약 글자 수 ───────── */
const excerptCount = $('#excerpt-count');
const updateExcerpt = () => (excerptCount.textContent = String(f.excerpt.value.length));
f.excerpt.addEventListener('input', updateExcerpt);

/* ───────── 서식 툴바 ───────── */
function replaceSelection(text: string, selectStart?: number, selectEnd?: number) {
  const ta = f.body;
  const s = ta.selectionStart;
  const e = ta.selectionEnd;
  ta.focus();
  // execCommand 를 쓰면 브라우저 실행 취소(Ctrl+Z)가 유지됨
  const ok = document.execCommand?.('insertText', false, text);
  if (!ok) ta.setRangeText(text, s, e, 'end');
  if (selectStart !== undefined) ta.setSelectionRange(s + selectStart, s + (selectEnd ?? selectStart));
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
function wrap(before: string, after: string, placeholder: string) {
  const ta = f.body;
  const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || placeholder;
  replaceSelection(before + sel + after, before.length, before.length + sel.length);
}
function prefixLines(prefix: string | ((i: number) => string)) {
  const ta = f.body;
  const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  let end = ta.value.indexOf('\n', ta.selectionEnd);
  if (end === -1) end = ta.value.length;
  ta.setSelectionRange(start, end);
  const lines = ta.value.slice(start, end).split('\n');
  const out = lines.map((l, i) => (typeof prefix === 'function' ? prefix(i) : prefix) + l.replace(/^(#{1,6}\s|>\s|[-*]\s|\d+\.\s)/, '')).join('\n');
  replaceSelection(out);
}
function insertBlock(text: string) {
  const ta = f.body;
  const before = ta.value.slice(0, ta.selectionStart);
  const pre = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  replaceSelection(pre + text + '\n\n');
}
const actions: Record<string, () => void> = {
  h2: () => prefixLines('## '),
  h3: () => prefixLines('### '),
  bold: () => wrap('**', '**', '굵은 글씨'),
  italic: () => wrap('*', '*', '기울임'),
  ul: () => prefixLines('- '),
  ol: () => prefixLines((i) => `${i + 1}. `),
  quote: () => prefixLines('> '),
  hr: () => insertBlock('---'),
  link: () => {
    const url = prompt('링크 주소(https://...)를 입력하세요');
    if (!url) return f.body.focus();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return toast('https:// 로 시작하는 주소를 입력해 주세요.', true);
    const ta = f.body;
    const text = ta.value.slice(ta.selectionStart, ta.selectionEnd) || '링크 텍스트';
    replaceSelection(`[${text}](${url})`, 1, 1 + text.length);
  },
  image: () => $<HTMLInputElement>('#file-body').click(),
  youtube: () => {
    const url = prompt('유튜브 영상 주소를 붙여넣으세요');
    if (!url) return f.body.focus();
    if (!youtubeId(url)) return toast('유튜브 영상 주소가 아니에요.', true);
    insertBlock(url.trim());
  },
};
document.querySelectorAll<HTMLButtonElement>('[data-md]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.md!]?.()));

/* ───────── 이미지 업로드 (드래그&드롭 / 붙여넣기 / 파일 선택) ───────── */
const uploadStatus = $('#upload-status');
const ALT_PLACEHOLDER = '사진 설명을 입력하세요';
let uploading = 0;
function setUploadStatus(msg: string) {
  uploadStatus.textContent = msg;
  uploadStatus.classList.toggle('hidden', !msg);
}
async function uploadIntoBody(files: File[]) {
  const imgs = files.filter((x) => x.type.startsWith('image/') || /\.(heic|heif)$/i.test(x.name));
  if (!imgs.length) return toast('이미지 파일만 올릴 수 있어요.', true);
  const tokens = imgs.map((file, i) => ({ file, token: `![업로드 중… ${Date.now()}-${i}]()` }));
  insertBlock(tokens.map((t) => t.token).join('\n\n'));
  let firstAlt = -1;
  for (const [i, { file, token }] of tokens.entries()) {
    uploading++;
    setUploadStatus(`사진 ${i + 1}/${tokens.length} 처리 중…`);
    try {
      const r = await processAndUpload(file, (m) => setUploadStatus(`사진 ${i + 1}/${tokens.length}: ${m}`));
      const md = `![${ALT_PLACEHOLDER}](${r.url})`;
      const pos = f.body.value.indexOf(token);
      if (pos >= 0) {
        f.body.setRangeText(md, pos, pos + token.length, 'preserve');
        if (firstAlt < 0) firstAlt = pos + 2;
      } else {
        insertBlock(md);
      }
      if (!coverSrc) setCover(r.url, '');
    } catch (e) {
      const pos = f.body.value.indexOf(token);
      if (pos >= 0) f.body.setRangeText('', pos, pos + token.length, 'preserve');
      toast(errMsg(e), true, 5000);
    } finally {
      uploading--;
    }
  }
  setUploadStatus('');
  f.body.dispatchEvent(new Event('input', { bubbles: true }));
  if (firstAlt >= 0) {
    f.body.focus();
    f.body.setSelectionRange(firstAlt, firstAlt + ALT_PLACEHOLDER.length);
    toast('사진 설명(alt)을 입력해 주세요. 선택된 글자를 바로 덮어쓰면 돼요.');
  }
}
$<HTMLInputElement>('#file-body').addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  uploadIntoBody([...(input.files ?? [])]);
  input.value = '';
});
f.body.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files ?? [])].filter((x) => x.type.startsWith('image/'));
  if (files.length) {
    e.preventDefault();
    uploadIntoBody(files);
  }
});
const dropZone = f.body;
dropZone.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types.includes('Files')) {
    e.preventDefault();
    dropZone.classList.add('drop-active');
  }
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-active'));
dropZone.addEventListener('drop', (e) => {
  dropZone.classList.remove('drop-active');
  const files = [...(e.dataTransfer?.files ?? [])];
  if (!files.length) return;
  e.preventDefault();
  uploadIntoBody(files);
});

/* ───────── 대표 이미지 ───────── */
const coverImg = $<HTMLImageElement>('#cover-img');
const coverEmpty = $('#cover-empty');
function setCover(src: string, alt?: string) {
  coverSrc = src;
  if (alt !== undefined && !f.coverAlt.value) f.coverAlt.value = alt;
  coverImg.classList.toggle('hidden', !src);
  coverEmpty.classList.toggle('hidden', !!src);
  if (src) {
    // 목록용 작은 크기로 미리보기
    const p = parseMediaUrl(src);
    coverImg.src = p && p.width > 960 ? mediaUrl({ ...p, variant: null }, 960) : src;
  } else coverImg.removeAttribute('src');
  markDirty();
}
$('[data-cover-upload]').addEventListener('click', () => $<HTMLInputElement>('#file-cover').click());
$<HTMLInputElement>('#file-cover').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const btn = $<HTMLButtonElement>('[data-cover-upload]');
  await withBusy(btn, '올리는 중', async () => {
    try {
      const r = await processAndUpload(file);
      setCover(r.url);
      f.coverAlt.focus();
      toast('대표 이미지를 바꿨어요. 설명(alt)도 입력해 주세요.');
    } catch (err) {
      toast(errMsg(err), true, 5000);
    }
  });
});
$('[data-cover-first]').addEventListener('click', () => {
  const m = /!\[([^\]]*)\]\(([^)\s]+)/.exec(f.body.value);
  if (!m || m[2] === '') return toast('본문에 사진이 없어요.', true);
  setCover(m[2], m[1] === ALT_PLACEHOLDER ? '' : m[1]);
});
$('[data-cover-remove]').addEventListener('click', () => setCover(''));

/* ───────── 저장 ───────── */
function collect(status: 'draft' | 'published') {
  const rating = Number((document.querySelector<HTMLInputElement>('input[name="rating"]:checked') || { value: '0' }).value);
  return {
    title: f.title.value.trim(),
    slug: f.slug.value.trim() || slugify(f.title.value),
    category: f.category.value,
    tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    excerpt: f.excerpt.value.trim(),
    body: f.body.value,
    status,
    publishedAt: f.date.value ? fromKstInput(f.date.value) : undefined,
    cover: coverSrc ? { src: coverSrc, alt: f.coverAlt.value.trim() } : null,
    place: {
      name: f.pName.value.trim(),
      region: f.pRegion.value.trim(),
      address: f.pAddress.value.trim(),
      mapUrl: f.pMap.value.trim(),
      rating: rating || undefined,
      priceRange: f.pPrice.value.trim(),
      visitedAt: f.pVisited.value,
    },
  };
}

async function save(status: 'draft' | 'published', btn: HTMLButtonElement | null, force = false) {
  if (saving) return;
  if (uploading > 0) return toast('사진 업로드가 끝난 뒤 저장해 주세요.', true);
  const data = collect(status);
  if (!data.title) {
    f.title.focus();
    return toast('제목을 입력해 주세요.', true);
  }
  if (!isValidSlug(data.slug)) {
    f.slug.focus();
    return toast('주소(슬러그)는 한글, 영문 소문자, 숫자, 하이픈만 쓸 수 있어요.', true);
  }
  if (status === 'published') {
    if (!data.body.trim()) return toast('본문을 작성해 주세요.', true);
    const missingAlt = (data.body.match(/!\[([^\]]*)\]\([^)]+\)/g) || []).filter((m) => /^!\[(|사진 설명을 입력하세요)\]/.test(m)).length;
    const coverNoAlt = data.cover && !data.cover.alt;
    if (missingAlt || coverNoAlt) {
      const ok = await confirmDialog(
        `설명(alt)이 없는 사진이 ${missingAlt + (coverNoAlt ? 1 : 0)}장 있어요. 검색 노출과 접근성을 위해 입력을 권장해요. 그래도 발행할까요?`,
        { title: '사진 설명 확인', okLabel: '그대로 발행' },
      );
      if (!ok) return;
    }
  }
  if (status === 'draft' && currentStatus === 'published' && !force) {
    const ok = await confirmDialog('임시저장하면 이 글이 블로그에서 내려가요(비공개). 계속할까요?', { title: '발행 취소', okLabel: '비공개로 저장' });
    if (!ok) return;
  }
  saving = true;
  const oldBackupKey = backupKey();
  try {
    await withBusy(btn, '저장 중', async () => {
      const payload = { ...data, baseUpdatedAt, force };
      const r = postId
        ? await api<{ id: string; slug: string; updatedAt: string }>(`/api/admin/posts/${postId}`, { method: 'PUT', json: payload })
        : await api<{ id: string; slug: string; updatedAt: string }>('/api/admin/posts', { method: 'POST', json: payload });
      const wasNew = !postId;
      postId = r.id;
      baseUpdatedAt = r.updatedAt;
      currentStatus = status;
      if (r.slug !== f.slug.value) {
        f.slug.value = r.slug;
        toast(`같은 주소의 글이 있어 주소를 '${r.slug}'로 바꿨어요.`);
      }
      slugManual = true;
      updateSlugHint();
      dirty = false;
      clearBackup(oldBackupKey);
      clearBackup();
      if (!f.date.value) f.date.value = toKstInput(new Date().toISOString());
      updateDateUi();
      const future = new Date(fromKstInput(f.date.value)).getTime() > Date.now();
      saveState.textContent =
        status === 'draft' ? '임시저장됨' : future ? '예약 발행됨' : '발행됨 · 블로그에 반영됐어요';
      toast(status === 'draft' ? '임시저장했어요.' : future ? '예약 발행했어요.' : '발행했어요! 🎉');
      if (wasNew) history.replaceState(null, '', `/admin/posts/${r.id}`);
      const view = document.querySelector<HTMLAnchorElement>('[data-view-link]');
      if (view) view.href = `/post/${r.slug}`;
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.data?.conflict) {
      const ok = await confirmDialog(e.message, { title: '수정 충돌', okLabel: '덮어쓰기', danger: true });
      saving = false;
      if (ok) return save(status, btn, true);
      return;
    }
    toast(errMsg(e), true, 5000);
  } finally {
    saving = false;
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((b) =>
  b.addEventListener('click', () => save(b.dataset.save as 'draft' | 'published', b)),
);

/* ───────── 삭제 ───────── */
document.querySelector<HTMLButtonElement>('[data-delete-post]')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  const ok = await confirmDialog(`'${f.title.value}' 글을 삭제할까요? 삭제한 글은 되돌릴 수 없어요.`, { title: '글 삭제', okLabel: '삭제', danger: true });
  if (!ok || !postId) return;
  await withBusy(btn, '삭제 중', async () => {
    try {
      await api(`/api/admin/posts/${postId}`, { method: 'DELETE' });
      dirty = false;
      clearBackup();
      location.href = '/admin?msg=' + encodeURIComponent('글을 삭제했어요.');
    } catch (err) {
      toast(errMsg(err), true);
    }
  });
});

/* ───────── 모바일 탭 ───────── */
const split = $('#editor-split');
document.querySelectorAll<HTMLButtonElement>('button[data-tab]').forEach((b) => {
  b.addEventListener('click', () => {
    split.dataset.tab = b.dataset.tab!;
    document.querySelectorAll<HTMLButtonElement>('button[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    if (b.dataset.tab === 'preview') renderPreview();
  });
});

/* ───────── 단축키 / 변경 감지 ───────── */
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === 's') {
    e.preventDefault();
    save(currentStatus, document.querySelector(`[data-save="${currentStatus}"]`));
  } else if (document.activeElement === f.body && (k === 'b' || k === 'i' || k === 'k')) {
    e.preventDefault();
    actions[k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'link']();
  }
});
$('#post-form').addEventListener('input', (e) => {
  if ((e.target as HTMLElement).id === 'f-body') renderPreview();
  markDirty();
});
$('#post-form').addEventListener('change', markDirty);
window.addEventListener('beforeunload', (e) => {
  if (dirty || uploading > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ───────── 이전 작성 내용 복구 ───────── */
function checkBackup() {
  try {
    const raw = localStorage.getItem(backupKey());
    if (!raw) return;
    const b = JSON.parse(raw) as { savedAt: string; data: ReturnType<typeof collect> };
    const serverAt = initial.post?.updatedAt ?? '';
    if (b.savedAt <= serverAt) return clearBackup();
    if (b.data.body === f.body.value && b.data.title === f.title.value) return clearBackup();
    const banner = $('#restore-banner');
    banner.classList.remove('hidden');
    banner.classList.add('flex');
    banner.querySelector('[data-restore]')!.addEventListener('click', () => {
      const d = b.data;
      f.title.value = d.title;
      f.slug.value = d.slug;
      f.body.value = d.body;
      f.excerpt.value = d.excerpt;
      f.tags.value = d.tags.join(', ');
      if (d.category) f.category.value = d.category;
      if (d.cover) {
        f.coverAlt.value = d.cover.alt;
        setCover(d.cover.src);
      }
      banner.remove();
      renderPreview();
      updateSlugHint();
      markDirty();
    });
    banner.querySelector('[data-discard]')!.addEventListener('click', () => {
      clearBackup();
      banner.remove();
    });
  } catch {}
}

/* ───────── 초기화 ───────── */
if (coverSrc) {
  setCover(coverSrc);
}
clearTimeout(backupTimer);
dirty = false;
saveState.textContent = initial.post ? (initial.post.status === 'published' ? '발행됨' : '임시저장됨') : '새 글';
updateSlugHint();
updateDateUi();
updateExcerpt();
renderPreview();
checkBackup();
if (!initial.post) f.title.focus();
// 카테고리가 맛집/여행이면 장소 정보 펼치기
f.category.addEventListener('change', () => {
  if (['food', 'travel'].includes(f.category.value)) ($('#place-box') as HTMLDetailsElement).open = true;
});
