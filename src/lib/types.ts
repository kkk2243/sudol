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

/** 메뉴 한 칸 / 버튼 하나 */
export interface MenuItem {
  label: string;
  /** /category/food, /about 처럼 사이트 안 주소 또는 https:// 외부 주소 */
  href: string;
  /** 새 창으로 열기 */
  newTab?: boolean;
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

  /* ── 메뉴·화면 구성 (관리자 → 메뉴·홈 화면) ── */
  /** 헤더 왼쪽 로고 글자 */
  logoText: string;
  /** 헤더 메뉴 */
  menuHeader: MenuItem[];
  /** 헤더 오른쪽 회색 버튼 (label 이 비면 숨김) */
  headerCta: MenuItem;
  /** 푸터 가운데 메뉴 */
  menuFooter: MenuItem[];
  /** 홈 상단: 검은 알약 라벨 / 큰 제목(줄바꿈 가능) / 부제 */
  heroLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  /** 페이지 아래 어두운 배너 */
  bannerEnabled: boolean;
  bannerLabel: string;
  bannerTitle: string;
  bannerText: string;
  bannerPrimary: MenuItem;
  bannerSecondary: MenuItem;
  /** 푸터 왼쪽 문구(줄바꿈 가능) */
  footerSlogan: string;
}
