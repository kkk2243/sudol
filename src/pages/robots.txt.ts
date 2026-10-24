import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/env';
import { setPublicCache } from '../lib/cache';

export const GET: APIRoute = ({ url }) => {
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /search?

Sitemap: ${siteUrl(url)}/sitemap.xml
`;
  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  setPublicCache(headers);
  return new Response(body, { headers });
};
