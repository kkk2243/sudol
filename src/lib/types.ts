export type PostStatus = 'draft' | 'published';

export interface PlaceInfo {
  name?: string;
  region?: string;
  address?: string;
  mapUrl?: string;
  rating?: number; // 1~5
  priceRange?: string;
  visitedAt?: string; // YYYY-MM-DD
}

export interface CoverImage {
  src: string;
  alt: string;
}

/** 저장되는 글 전체 */
export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string; // 마크다운
  category: string; // 카테고리 slug
  tags: string[];
  cover?: CoverImage | null;
  status: PostStatus;
  publishedAt: string; // ISO (UTC)
  createdAt: string;
  updatedAt: string;
  place?: PlaceInfo | null;
  sample?: boolean;
}

/** 목록/검색용 인덱스 항목 (본문 제외) */
export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  cover?: CoverImage | null;
  status: PostStatus;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  placeName?: string;
  placeRegion?: string;
  sample?: boolean;
  /** 검색용 본문 일부(앞부분, 마크다운 제거) */
  searchText: string;
}

export interface Category {
  slug: string;
  name: string;
  emoji: string;
  description: string;
}

export interface AdSlots {
  top: string;
  middle: string;
  bottom: string;
  sidebar: string;
}

export interface Settings {
  title: string;
  tagline: string;
  description: string;
  authorName: string;
  aboutBody: string; // 마크다운
  profileImage: string;
  contactEmail: string;
  adsenseClient: string; // ca-pub-xxxxxxxx
  adSlots: AdSlots;
  adsTxt: string;
}
