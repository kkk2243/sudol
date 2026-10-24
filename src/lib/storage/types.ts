/**
 * 저장소 추상화 인터페이스.
 * 이 인터페이스만 구현하면 Netlify Blobs 대신 Cloudflare R2, S3, 로컬 파일 등으로 바꿀 수 있습니다.
 * 키는 "posts/abc.json" 처럼 슬래시로 구분된 문자열입니다.
 */
export interface BinaryObject {
  data: ArrayBuffer;
  contentType: string;
}

export interface KVStore {
  getJSON<T>(key: string): Promise<T | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  getBinary(key: string): Promise<BinaryObject | null>;
  setBinary(key: string, data: ArrayBuffer | Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** prefix 로 시작하는 모든 키 */
  list(prefix?: string): Promise<string[]>;
}

/** 데이터 성격별로 나눈 저장소 이름 */
export type StoreName = 'content' | 'media' | 'auth';
