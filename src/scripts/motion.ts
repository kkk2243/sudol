/**
 * 공개 페이지 스크롤 효과 (약 1KB)
 * - [data-reveal]      : 화면에 들어오면 아래에서 떠오르며 등장 (본문 사진·유튜브도 자동 적용)
 * - [data-parallax=0.1]: 스크롤에 따라 다른 속도로 움직이는 사진(배너의 떠 있는 사진)
 * - 헤더: 스크롤하면 테두리, 아래로 내리면 숨고 위로 올리면 다시 나타남
 * '동작 줄이기' 설정 사용자는 모든 효과를 끕니다.
 */
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
(window as any).__motionReady = true;

/* ── 등장 효과 ── */
if (!reduce && 'IntersectionObserver' in window) {
  document.querySelectorAll('.prose figure, .prose .yt, .prose .table-wrap').forEach((el) => el.setAttribute('data-reveal', ''));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
} else {
  root.classList.remove('motion');
}

/* ── 헤더 + 패럴랙스 ── */
const header = document.querySelector<HTMLElement>('[data-site-header]');
const floats = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
let lastY = window.scrollY;
let ticking = false;

function frame() {
  ticking = false;
  const y = window.scrollY;
  if (header) {
    header.classList.toggle('is-scrolled', y > 8);
    const menuOpen = !!document.querySelector('.mobile-menu:popover-open');
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > 280 && !menuOpen && !header.contains(document.activeElement)) header.classList.add('is-hidden');
    else if (goingUp || y < 80) header.classList.remove('is-hidden');
  }
  lastY = y;
  if (reduce) return;
  const vh = window.innerHeight;
  for (const el of floats) {
    // 움직이는 요소의 부모 위치를 기준으로 계산(자기 자신의 transform 영향 배제)
    const box = (el.parentElement ?? el).getBoundingClientRect();
    if (box.bottom < -300 || box.top > vh + 300) continue;
    const speed = parseFloat(el.dataset.parallax || '0.1');
    const offset = (box.top + box.height / 2 - vh / 2) * -speed;
    el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
  }
}

function onScroll() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(frame);
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });
frame();

/* ── 다크 모드 버튼 ── */
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
  const sync = () => b.setAttribute('aria-pressed', String(root.classList.contains('dark')));
  sync();
  b.addEventListener('click', () => {
    const dark = root.classList.toggle('dark');
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {}
    document.querySelectorAll('[data-theme-toggle]').forEach((x) => x.setAttribute('aria-pressed', String(dark)));
  });
}

/* ── 모바일 메뉴: 링크를 누르면 닫기 ── */
document.querySelectorAll<HTMLElement>('.mobile-menu a').forEach((a) =>
  a.addEventListener('click', () => (a.closest('.mobile-menu') as HTMLElement & { hidePopover?: () => void })?.hidePopover?.()),
);

/* ── 관리자로 로그인한 경우에만 관리자 도구 불러오기 ── */
if (document.cookie.split('; ').includes('sd_admin=1')) {
  import('./adminbar').then((m) => m.mountAdminBar()).catch(() => {});
}
