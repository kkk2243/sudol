import type { APIRoute } from 'astro';
import { siteData } from '../lib/site';
import { setPublicCache } from '../lib/cache';
import { siteUrl } from '../lib/env';
import { escapeXml } from '../lib/util';

export const GET: APIRoute = async ({ locals, url }) => {
  const site = await siteData(locals);
  const base = siteUrl(url);
  const latest = site.published[0]?.updatedAt || site.published[0]?.publishedAt;

  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${base}/`, lastmod: latest },
    { loc: `${base}/posts`, lastmod: latest },
    { loc: `${base}/about` },
    { loc: `${base}/contact` },
    { loc: `${base}/privacy` },
  ];
  for (const c of site.categories) {
    const last = site.published.find((p) => p.category === c.slug);
    if (last) urls.push({ loc: `${base}/category/${c.slug}`, lastmod: last.updatedAt || last.publishedAt });
  }
  const tags = new Set(site.published.flatMap((p) => p.tags));
  for (const t of tags) urls.push({ loc: `${base}/tag/${encodeURIComponent(t)}` });
  for (const p of site.published) {
    urls.push({ loc: `${base}/post/${encodeURIComponent(p.slug)}`, lastmod: p.updatedAt || p.publishedAt });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `<url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>`;
  const headers = new Headers({ 'Content-Type': 'application/xml; charset=utf-8' });
  setPublicCache(headers, { index: site.index });
  return new Response(xml, { headers });
};
