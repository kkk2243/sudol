import type { APIRoute } from 'astro';
import { handle, json, readJson } from '../../../lib/api';
import { getSettings, saveSettings } from '../../../lib/content';
import { buildSettings } from '../../../lib/validate';
import { purgePages } from '../../../lib/cache';

export const PUT: APIRoute = ({ request }) =>
  handle(async () => {
    const raw = await readJson(request, 60_000);
    const s = buildSettings(raw, await getSettings());
    await saveSettings(s);
    await purgePages();
    return json({ ok: true, settings: s });
  });
