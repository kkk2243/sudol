/** 서버 환경변수 읽기. Netlify 런타임은 process.env, 로컬 astro dev 는 .env → import.meta.env */
export function env(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  if (fromProcess) return fromProcess;
  const meta = (import.meta as any).env as Record<string, string | undefined> | undefined;
  return meta?.[name] || undefined;
}

/** 사이트 기준 URL (끝의 / 없음) */
export function siteUrl(requestUrl?: URL): string {
  const u = env('SITE_URL') || env('URL') || (requestUrl ? requestUrl.origin : 'http://localhost:4321');
  return u.replace(/\/+$/, '');
}
