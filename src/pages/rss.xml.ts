import type { APIRoute } from 'astro';
import { siteData } from '../lib/site';
import { setPublicCache } from '../lib/cache';
import { siteUrl } from '../lib/env';
import { escapeXml } from '../lib/util';

export const GET: APIRoute = async ({ locals, url }) => {
  const site = await siteData(locals);
  const base = siteUrl(url);
  const items = site.published
    .slice(0, 30)
    .map((p) => {
      const link = `${base}/post/${encodeURIComponent(p.slug)}`;
      const cat = site.categoryMap.get(p.category)?.name;
      return `<item>
<title>${escapeXml(p.title)}</title>
<link>${link}</link>
<guid isPermaLink="false">${p.id}</guid>
<pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
${cat ? `<category>${escapeXml(cat)}</category>` : ''}
<description>${escapeXml(p.excerpt)}</description>
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(site.settings.title)}</title>
<link>${base}/</link>
<description>${escapeXml(site.settings.description)}</description>
<language>ko</language>
<atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>
${site.published[0] ? `<lastBuildDate>${new Date(site.published[0].updatedAt || site.published[0].publishedAt).toUTCString()}</lastBuildDate>` : ''}
${items}
</channel>
</rss>`;
  const headers = new Headers({ 'Content-Type': 'application/rss+xml; charset=utf-8' });
  setPublicCache(headers, { index: site.index });
  return new Response(xml, { headers });
};
