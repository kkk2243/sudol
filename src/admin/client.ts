/** 관리자 화면 공용 브라우저 도우미 */

export function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
  ) {
    super(message);
  }
}

/** CSRF 토큰을 붙여 JSON API 호출. 실패 시 ApiError */
export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-csrf-token', csrfToken());
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError('네트워크 연결을 확인해 주세요.', 0);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (res.status === 401) {
    toast('로그인이 만료되었습니다. 다시 로그인해 주세요.', true);
    throw new ApiError('로그인이 필요합니다.', 401, data);
  }
  if (!res.ok || data?.ok === false) {
    throw new ApiError(data?.error || `요청 실패 (${res.status})`, res.status, data);
  }
  return data as T;
}

export function toast(message: string, error = false, ms = 3200): void {
  const root = document.getElementById('toast-root');
  if (!root) return alert(message);
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' is-error' : '');
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** 삭제 등 위험한 작업 전 확인 창 */
export function confirmDialog(message: string, opts: { title?: string; okLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  const dlg = document.getElementById('confirm-dialog') as HTMLDialogElement | null;
  if (!dlg || typeof dlg.showModal !== 'function') return Promise.resolve(window.confirm(message));
  dlg.querySelector('[data-title]')!.textContent = opts.title ?? '확인';
  dlg.querySelector('[data-message]')!.textContent = message;
  const ok = dlg.querySelector<HTMLButtonElement>('[data-ok]')!;
  ok.textContent = opts.okLabel ?? '확인';
  ok.classList.toggle('btn-danger', !!opts.danger);
  ok.classList.toggle('btn-primary', !opts.danger);
  dlg.returnValue = '';
  dlg.showModal();
  dlg.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
  });
}

/** 버튼을 "처리 중" 상태로 바꾸고 작업이 끝나면 되돌림 */
export async function withBusy<T>(btn: HTMLButtonElement | null, label: string, fn: () => Promise<T>): Promise<T> {
  if (!btn) return fn();
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${label}`;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
