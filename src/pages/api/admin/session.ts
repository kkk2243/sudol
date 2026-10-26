import type { APIRoute } from 'astro';
import { json } from '../../../lib/api';

/** 블로그 화면의 관리자 막대가 로그인 여부와 보안 토큰을 확인할 때 사용 (미들웨어가 로그인 확인) */
export const GET: APIRoute = ({ locals }) => json({ ok: true, csrf: locals.session?.csrf ?? '' });
