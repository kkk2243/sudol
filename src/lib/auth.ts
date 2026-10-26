/**
 * 관리자 인증
 * - 비밀번호: bcrypt 해시(환경변수 ADMIN_PASSWORD_HASH)와 비교
 * - 세션: HMAC-SHA256 으로 서명한 무상태 토큰을 HttpOnly 쿠키에 저장(12시간 만료)
 *   로그아웃 시 저장소의 세션 버전을 올려 이전 토큰을 모두 무효화
 * - CSRF: 세션마다 다른 토큰(HMAC(sid))을 헤더/폼으로 보내야 쓰기 요청이 통과 + Origin 확인
 * - 로그인 시도 제한: IP당 15분에 5회 실패 시 15분 잠금, 전체 1시간 30회 실패 시 잠금
 */
import bcrypt from 'bcryptjs';
import type { AstroCookies } from 'astro';
import { env } from './env';
import { store } from './storage';

export const SESSION_COOKIE = 'sd_session';
const SESSION_TTL_SEC = 12 * 60 * 60;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): string {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(pad), (c) => c.charCodeAt(0)));
}

function secret(): string {
  const s = env('SESSION_SECRET');
  if (!s || s.length < 32) throw new Error('SESSION_SECRET 환경변수가 없거나 너무 짧습니다(32자 이상).');
  return s;
}

let keyCache: { s: string; k: CryptoKey } | null = null;
async function hmacKey(): Promise<CryptoKey> {
  const s = secret();
  if (keyCache?.s === s) return keyCache.k;
  const k = await crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  keyCache = { s, k };
  return k;
}
async function sign(data: string): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(data)));
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function sha256(s: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0, 32);
}

/* ───────── 설정 확인 ───────── */

export function authConfigError(): string | null {
  if (!env('ADMIN_ID')) return 'ADMIN_ID 환경변수가 설정되지 않았습니다.';
  if (!passwordHash()) return 'ADMIN_PASSWORD_HASH 환경변수가 설정되지 않았거나 형식이 잘못되었습니다.';
  const s = env('SESSION_SECRET');
  if (!s || s.length < 32) return 'SESSION_SECRET 환경변수가 없거나 32자보다 짧습니다.';
  return null;
}

function passwordHash(): string | null {
  let h = env('ADMIN_PASSWORD_HASH')?.trim();
  if (!h) return null;
  if (h.startsWith('b64:')) {
    try {
      h = atob(h.slice(4));
    } catch {
      return null;
    }
  }
  return /^\$2[aby]\$\d{2}\$.{53}$/.test(h) ? h : null;
}

/* ───────── 로그인 시도 제한 ───────── */

interface Attempts {
  count: number;
  first: number;
  lockedUntil?: number;
}
const WINDOW = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const GLOBAL_WINDOW = 60 * 60 * 1000;
const MAX_GLOBAL = 30;

export async function loginLockedFor(ip: string): Promise<number> {
  const now = Date.now();
  const s = store('auth');
  const g = await s.getJSON<Attempts>('rl/global.json');
  if (g?.lockedUntil && g.lockedUntil > now) return g.lockedUntil - now;
  const a = await s.getJSON<Attempts>(`rl/${await sha256(ip)}.json`);
  if (a?.lockedUntil && a.lockedUntil > now) return a.lockedUntil - now;
  return 0;
}

export async function recordLoginFailure(ip: string): Promise<{ remaining: number }> {
  const now = Date.now();
  const s = store('auth');
  const key = `rl/${await sha256(ip)}.json`;
  let a = await s.getJSON<Attempts>(key);
  if (!a || now - a.first > WINDOW) a = { count: 0, first: now };
  a.count++;
  if (a.count >= MAX_PER_IP) a.lockedUntil = now + WINDOW;
  await s.setJSON(key, a);

  let g = await s.getJSON<Attempts>('rl/global.json');
  if (!g || now - g.first > GLOBAL_WINDOW) g = { count: 0, first: now };
  g.count++;
  if (g.count >= MAX_GLOBAL) g.lockedUntil = now + WINDOW;
  await s.setJSON('rl/global.json', g);
  return { remaining: Math.max(0, MAX_PER_IP - a.count) };
}

export async function clearLoginFailures(ip: string): Promise<void> {
  await store('auth').delete(`rl/${await sha256(ip)}.json`);
}

export async function verifyCredentials(id: string, password: string): Promise<boolean> {
  const hash = passwordHash();
  const adminId = env('ADMIN_ID') || '';
  // 아이디가 틀려도 bcrypt 비교는 수행해 응답 시간 차이로 아이디를 추측하지 못하게 함
  const dummy = '$2b$12$xTKrAy.SVgcqOa0p8dWiaOW/OH.vreOzhcPBOp12dn8TX9X7KEoWO';
  const okPw = await bcrypt.compare(password, hash || dummy);
  return !!hash && timingSafeEqual(id, adminId) && okPw;
}

/* ───────── 세션 ───────── */

interface SessionPayload {
  sid: string;
  exp: number; // ms
  v: number; // 세션 버전
}

async function sessionVersion(): Promise<number> {
  const v = await store('auth').getJSON<{ v: number }>('session-version.json');
  return v?.v ?? 1;
}

export async function bumpSessionVersion(): Promise<void> {
  const v = await sessionVersion();
  await store('auth').setJSON('session-version.json', { v: v + 1 });
}

export async function createSession(cookies: AstroCookies, secure: boolean): Promise<void> {
  const payload: SessionPayload = {
    sid: b64url(crypto.getRandomValues(new Uint8Array(18))),
    exp: Date.now() + SESSION_TTL_SEC * 1000,
    v: await sessionVersion(),
  };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const token = `${body}.${await sign(body)}`;
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
  // 블로그 화면에 관리자 막대를 띄울지 판단하는 표시용 쿠키(비밀 정보 없음, 실제 권한은 위 세션 쿠키로만 확인)
  cookies.set(ADMIN_FLAG_COOKIE, '1', { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SEC });
}

export const ADMIN_FLAG_COOKIE = 'sd_admin';

export function clearSession(cookies: AstroCookies, secure: boolean): void {
  cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 0 });
  cookies.set(ADMIN_FLAG_COOKIE, '', { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: 0 });
}

export interface Session {
  sid: string;
  exp: number;
  csrf: string;
}

export async function readSession(cookies: AstroCookies): Promise<Session | null> {
  const raw = cookies.get(SESSION_COOKIE)?.value;
  if (!raw || raw.length > 1000) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  try {
    if (!timingSafeEqual(sig, await sign(body))) return null;
    const p = JSON.parse(fromB64url(body)) as SessionPayload;
    if (!p.exp || p.exp < Date.now()) return null;
    if (p.v !== (await sessionVersion())) return null;
    return { sid: p.sid, exp: p.exp, csrf: await sign('csrf:' + p.sid) };
  } catch {
    return null;
  }
}

export function checkCsrf(session: Session, provided: string | null | undefined): boolean {
  return !!provided && timingSafeEqual(provided, session.csrf);
}

/** 쓰기 요청의 Origin 이 같은 사이트인지 */
export function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const ref = request.headers.get('referer');
  if (ref) {
    try {
      return new URL(ref).origin === url.origin;
    } catch {
      return false;
    }
  }
  return false;
}

export function clientIp(request: Request, fallback?: string): string {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    fallback ||
    'unknown'
  );
}
