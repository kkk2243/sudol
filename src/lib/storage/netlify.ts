import { getStore } from '@netlify/blobs';
import type { BinaryObject, KVStore, StoreName } from './types';

/** Netlify Blobs 드라이버 (배포 환경 기본값) */
export function netlifyStore(name: StoreName): KVStore {
  // strong: 저장 직후 캐시 퍼지 → 재렌더링될 때 반드시 최신 데이터를 읽도록.
  const store = getStore({ name: `sudol-${name}`, consistency: 'strong' });

  return {
    async getJSON<T>(key: string) {
      const v = await store.get(key, { type: 'json' });
      return (v ?? null) as T | null;
    },
    async setJSON(key, value) {
      await store.setJSON(key, value);
    },
    async getBinary(key): Promise<BinaryObject | null> {
      const r = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      if (!r || !r.data) return null;
      const ct = typeof r.metadata?.contentType === 'string' ? r.metadata.contentType : 'application/octet-stream';
      return { data: r.data, contentType: ct };
    },
    async setBinary(key, data, contentType) {
      const buf = data instanceof Uint8Array ? data.slice().buffer : data;
      await store.set(key, buf as ArrayBuffer, { metadata: { contentType } });
    },
    async delete(key) {
      await store.delete(key);
    },
    async list(prefix = '') {
      const keys: string[] = [];
      for await (const page of store.list({ prefix, paginate: true })) {
        for (const b of page.blobs) keys.push(b.key);
      }
      return keys;
    },
  };
}
