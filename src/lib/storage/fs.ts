import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BinaryObject, KVStore, StoreName } from './types';

/** 로컬 개발용 파일 드라이버. 프로젝트의 .data/<store>/ 아래에 저장합니다. */
export function fsStore(name: StoreName): KVStore {
  const root = path.resolve(process.cwd(), '.data', name);

  const safe = (key: string) => {
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error('잘못된 키');
    return p;
  };

  async function walk(dir: string): Promise<string[]> {
    let out: string[] = [];
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out = out.concat(await walk(full));
      else if (!e.name.endsWith('.__meta')) out.push(path.relative(root, full).split(path.sep).join('/'));
    }
    return out;
  }

  return {
    async getJSON<T>(key: string) {
      try {
        return JSON.parse(await fs.readFile(safe(key), 'utf8')) as T;
      } catch {
        return null;
      }
    },
    async setJSON(key, value) {
      const p = safe(key);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, JSON.stringify(value));
    },
    async getBinary(key): Promise<BinaryObject | null> {
      try {
        const p = safe(key);
        const buf = await fs.readFile(p);
        let contentType = 'application/octet-stream';
        try {
          contentType = (await fs.readFile(p + '.__meta', 'utf8')).trim() || contentType;
        } catch {}
        return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, contentType };
      } catch {
        return null;
      }
    },
    async setBinary(key, data, contentType) {
      const p = safe(key);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, data instanceof Uint8Array ? data : new Uint8Array(data));
      await fs.writeFile(p + '.__meta', contentType);
    },
    async delete(key) {
      const p = safe(key);
      await fs.rm(p, { force: true });
      await fs.rm(p + '.__meta', { force: true });
    },
    async list(prefix = '') {
      return (await walk(root)).filter((k) => k.startsWith(prefix)).sort();
    },
  };
}
