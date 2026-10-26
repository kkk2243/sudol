/**
 * 관리자 도구 막대 (관리자로 로그인했을 때만 불러옴)
 * - 화면 아래 떠 있는 막대: 새 글 / 이 글 수정 / 이 글 삭제 / 메뉴 편집 / 관리자 홈 / 로그아웃
 * - 글 목록 카드마다 '수정' 버튼
 * 공개 페이지는 CDN에 캐시되므로, 로그인 여부는 서버가 아니라 여기서 확인합니다.
 */
const CSS = `
.sdab{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:90;display:flex;align-items:center;gap:4px;max-width:calc(100vw - 24px);overflow-x:auto;scrollbar-width:none;padding:6px;border-radius:999px;background:#111;color:#fff;box-shadow:0 12px 40px rgb(0 0 0 / .35);font:600 14px/1 var(--font-sans,system-ui);animation:sdab-in .5s cubic-bezier(.16,.84,.24,1)}
.sdab::-webkit-scrollbar{display:none}
.sdab a,.sdab button{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;height:38px;padding:0 14px;border-radius:999px;color:#fff;background:transparent;border:0;cursor:pointer;font:inherit;text-decoration:none}
.sdab a:hover,.sdab button:hover{background:rgb(255 255 255 / .12)}
.sdab .sdab-primary{background:#ff5a1f;color:#111}
.sdab .sdab-primary:hover{background:#ff7a45}
.sdab .sdab-danger{color:#fca5a5}
.sdab .sdab-tag{padding:0 10px 0 12px;color:#a1a1aa;font-weight:700;font-size:12px}
.sdab .sdab-sep{width:1px;height:20px;background:rgb(255 255 255 / .18);flex:none}
.sdab.is-min{padding:4px}
.sdab.is-min > :not(.sdab-toggle){display:none}
.sdab-edit{position:absolute;z-index:5;top:52px;right:14px;display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 12px;border-radius:999px;background:#111;color:#fff;font:700 12px/1 var(--font-sans,system-ui);text-decoration:none;box-shadow:0 6px 18px rgb(0 0 0 / .3)}
.sdab-edit:hover{background:#ff5a1f;color:#111}
@keyframes sdab-in{from{opacity:0;transform:translate(-50%,20px)}}
`;

function clearFlag() {
  document.cookie = 'sd_admin=; Max-Age=0; Path=/; SameSite=Lax';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}

export async function mountAdminBar(): Promise<void> {
  let csrf = '';
  try {
    const r = await fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) {
      clearFlag();
      return;
    }
    csrf = (await r.json()).csrf || '';
  } catch {
    return;
  }

  const style = el('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const bar = el('nav', { class: 'sdab', 'aria-label': '관리자 도구' });
  bar.append(el('span', { class: 'sdab-tag' }, '관리자'));
  bar.append(el('a', { href: '/admin/posts/new', class: 'sdab-primary' }, '✏️ 새 글 쓰기'));

  const article = document.querySelector<HTMLElement>('article[data-post-id]');
  if (article) {
    const id = article.dataset.postId!;
    const title = article.dataset.postTitle || '이 글';
    bar.append(el('a', { href: `/admin/posts/${id}` }, '이 글 수정'));
    const del = el('button', { type: 'button', class: 'sdab-danger' }, '이 글 삭제');
    del.addEventListener('click', async () => {
      if (!confirm(`'${title}' 글을 삭제할까요?\n삭제한 글은 되돌릴 수 없어요.`)) return;
      del.textContent = '삭제 중…';
      const r = await fetch(`/api/admin/posts/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrf },
        credentials: 'same-origin',
      }).catch(() => null);
      if (r?.ok) location.href = '/';
      else {
        del.textContent = '이 글 삭제';
        alert('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    });
    bar.append(del);
  }

  bar.append(el('span', { class: 'sdab-sep', 'aria-hidden': 'true' }));
  bar.append(el('a', { href: '/admin' }, '글 관리'));
  bar.append(el('a', { href: '/admin/menu' }, '메뉴·홈 화면'));
  bar.append(el('a', { href: '/admin/settings' }, '설정'));
  const out = el('button', { type: 'button' }, '로그아웃');
  out.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST', headers: { 'x-csrf-token': csrf }, credentials: 'same-origin' }).catch(() => {});
    clearFlag();
    location.reload();
  });
  bar.append(out);

  const toggle = el('button', { type: 'button', class: 'sdab-toggle', 'aria-label': '관리자 막대 접기', 'aria-expanded': 'true' }, '—');
  toggle.addEventListener('click', () => {
    const min = bar.classList.toggle('is-min');
    toggle.textContent = min ? '🍙' : '—';
    toggle.setAttribute('aria-expanded', String(!min));
    toggle.setAttribute('aria-label', min ? '관리자 막대 펼치기' : '관리자 막대 접기');
  });
  bar.append(toggle);
  document.body.appendChild(bar);

  // 카드마다 '수정' 버튼
  document.querySelectorAll<HTMLElement>('[data-tile-id]').forEach((tile) => {
    const a = el('a', { href: `/admin/posts/${tile.dataset.tileId}`, class: 'sdab-edit' }, '✏️ 수정');
    tile.appendChild(a);
  });
}
