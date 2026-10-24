/**
 * 저장소 진입점. 앱의 다른 코드는 오직 이 모듈의 store() 만 사용합니다.
 * 다른 저장소(Cloudflare R2 등)로 옮길 때는 새 드라이버 파일을 만들고 아래 switch 에 추가하면 됩니다.
 */
import { env } from '../env';
import type { KVStore, StoreName } from './types';
import { netlifyStore } from './netlify';
import { fsStore } from './fs';

export type { KVStore, StoreName, BinaryObject } from './types';

const cache = new Map<StoreName, KVStore>();

function driverName(): 'netlify' | 'fs' {
  const forced = env('STORAGE_DRIVER');
  if (forced === 'fs' || forced === 'netlify') return forced;
  return import.meta.env.DEV ? 'fs' : 'netlify';
}

export function store(name: StoreName): KVStore {
  let s = cache.get(name);
  if (!s) {
    s = driverName() === 'fs' ? fsStore(name) : netlifyStore(name);
    cache.set(name, s);
  }
  return s;
}
