/** API 응답 도우미 */
export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Netlify-CDN-Cache-Control': 'no-store',
      ...extra,
    },
  });
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: message, ...extra }, status);
}

/** 용량 제한을 지키며 JSON 본문 읽기 */
export async function readJson<T = any>(request: Request, maxBytes = 1_000_000): Promise<T> {
  const len = Number(request.headers.get('content-length') || '0');
  if (len > maxBytes) throw new HttpError(413, '요청이 너무 큽니다.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, '요청이 너무 큽니다.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'JSON 형식이 올바르지 않습니다.');
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 핸들러 래퍼: HttpError → 해당 상태코드, 그 외 → 500 */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e) => {
    if (e instanceof HttpError) return fail(e.message, e.status);
    console.error(e);
    return fail('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 500);
  });
}

export const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
