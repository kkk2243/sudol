import type { Category, Post, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  title: '수돌이의 맛집 일상 여행 블로그',
  tagline: '맛있는 한 끼, 소소한 하루, 가벼운 여행',
  description: '수돌이가 직접 다녀온 맛집과 여행지, 그리고 평범하지만 소중한 일상을 기록하는 블로그입니다.',
  authorName: '수돌이',
  aboutBody: `안녕하세요, **수돌이**입니다.

먹는 걸 좋아해서 시작한 기록이 어느새 여행과 일상까지 넓어졌어요. 이 블로그에는 제가 **직접 가보고, 직접 먹어보고, 직접 걸어본 곳**만 올립니다.

## 이런 이야기를 씁니다

- **맛집** — 동네 숨은 밥집부터 줄 서는 집까지, 솔직한 후기
- **일상** — 주말 루틴, 집밥, 소소하게 좋았던 것들
- **여행** — 당일치기 근교 여행부터 긴 휴가까지, 동선과 팁 위주로

## 원칙

1. 협찬이나 광고를 받은 글은 글 첫머리에 분명하게 밝힙니다.
2. 가격과 영업시간은 방문 당시 기준이라 바뀔 수 있어요. 방문 전 한 번 더 확인해 주세요.
3. 사진은 모두 제가 직접 찍은 것입니다.

궁금한 점이나 제안은 [연락처](/contact) 페이지로 편하게 보내주세요.`,
  profileImage: '',
  contactEmail: '',
  adsenseClient: '',
  adSlots: { top: '', middle: '', bottom: '', sidebar: '' },
  adsTxt: '',
};

export const DEFAULT_CATEGORIES: Category[] = [
  { slug: 'food', name: '맛집', emoji: '🍜', description: '직접 먹어보고 쓰는 솔직한 맛집 기록' },
  { slug: 'daily', name: '일상', emoji: '☕', description: '평범해서 더 소중한 하루하루' },
  { slug: 'travel', name: '여행', emoji: '🧳', description: '가볍게 떠나고 꼼꼼하게 남기는 여행기' },
];

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();

function sample(p: Omit<Post, 'createdAt' | 'updatedAt' | 'status' | 'sample'>): Post {
  return { ...p, status: 'published', createdAt: p.publishedAt, updatedAt: p.publishedAt, sample: true };
}

export const SAMPLE_POSTS: Post[] = [
  sample({
    id: 'sample0food1',
    slug: '샘플-골목-칼국수집-후기',
    title: '[샘플] 비 오는 날 생각나는 골목 칼국수집',
    excerpt: '바지락이 듬뿍 들어간 칼국수와 직접 담근 겉절이. 비 오는 날이면 줄이 길어지는 골목 칼국수집 방문기입니다.',
    category: 'food',
    tags: ['칼국수', '비오는날', '혼밥'],
    cover: { src: '/placeholders/food.svg', alt: '따뜻한 국수 그릇을 표현한 일러스트' },
    publishedAt: daysAgo(1),
    place: {
      name: '골목 칼국수(샘플)',
      region: '서울 종로',
      address: '서울특별시 종로구 예시로 12 (샘플 주소)',
      mapUrl: 'https://map.naver.com/',
      rating: 4,
      priceRange: '1인 1만원 이하',
      visitedAt: daysAgo(3).slice(0, 10),
    },
    body: `> 이 글은 블로그 구성을 보여주기 위한 **샘플 글**입니다. 실제 가게가 아니며, 애드센스 신청 전에 관리자 화면에서 삭제해 주세요.

비가 추적추적 내리던 토요일 점심, 따뜻한 국물이 당겨서 오래전부터 저장해 둔 골목 칼국수집을 찾았습니다.

## 가게 분위기

테이블 여섯 개 남짓한 작은 가게예요. 점심 피크에는 10분 정도 기다렸고, 회전이 빨라서 오래 걸리지는 않았습니다.

## 주문한 메뉴

- 바지락 칼국수
- 김치 만두 (반 접시)

국물은 바지락에서 우러난 시원한 맛이 먼저 오고, 끝맛이 깔끔합니다. 면은 손으로 썬 듯 두께가 조금씩 달라서 씹는 재미가 있었어요.

![칼국수 그릇 일러스트(샘플 이미지)](/placeholders/food.svg "샘플 이미지 — 실제 사진으로 교체하세요")

## 총평

| 항목 | 평가 |
| --- | --- |
| 맛 | ★★★★☆ |
| 가격 | 합리적 |
| 재방문 | 의사 있음 |

비 오는 날 혼밥 장소로 강력 추천합니다. 겉절이는 리필이 가능해요.
`,
  }),
  sample({
    id: 'sample0food2',
    slug: '샘플-동네-빵집-소금빵',
    title: '[샘플] 아침 8시에 문 여는 동네 빵집의 소금빵',
    excerpt: '갓 구운 소금빵을 사러 아침 일찍 나섰다. 버터 향과 짭짤한 끝맛이 좋은 동네 빵집 이야기.',
    category: 'food',
    tags: ['빵집', '소금빵', '아침'],
    cover: { src: '/placeholders/cafe.svg', alt: '빵과 커피잔을 표현한 일러스트' },
    publishedAt: daysAgo(6),
    place: {
      name: '아침빵집(샘플)',
      region: '경기 성남',
      address: '경기도 성남시 분당구 예시길 3 (샘플 주소)',
      mapUrl: 'https://map.kakao.com/',
      rating: 5,
      priceRange: '빵 1개 3,000원대',
      visitedAt: daysAgo(7).slice(0, 10),
    },
    body: `> 이 글은 **샘플 글**입니다. 관리자 → 데이터 관리에서 한 번에 삭제할 수 있어요.

주말 아침, 오픈 시간에 맞춰 동네 빵집에 다녀왔습니다.

## 소금빵

겉은 바삭하고 속은 버터가 녹아 촉촉합니다. 위에 올린 소금 알갱이가 단맛을 끌어올려 줘요.

## 같이 산 것

1. 크림치즈 베이글
2. 무화과 캄파뉴

> 오전 10시 전에 소금빵이 다 팔리는 날이 많으니 일찍 가는 걸 추천해요.
`,
  }),
  sample({
    id: 'sample0dly01',
    slug: '샘플-주말-아침-루틴',
    title: '[샘플] 느리게 시작하는 주말 아침 루틴',
    excerpt: '알람 없이 일어나 커피를 내리고, 동네를 한 바퀴 걷는 주말 아침. 별것 아니지만 한 주를 버티게 해주는 루틴을 적어봤다.',
    category: 'daily',
    tags: ['주말', '루틴', '커피'],
    cover: { src: '/placeholders/daily.svg', alt: '창가의 커피잔과 햇살을 표현한 일러스트' },
    publishedAt: daysAgo(3),
    place: null,
    body: `> 이 글은 **샘플 글**입니다.

평일에는 늘 시간에 쫓기다 보니 주말 아침만큼은 천천히 보내려고 해요.

## 1. 알람 끄기

토요일에는 알람을 맞추지 않습니다. 그래도 몸이 기억하는지 여덟 시쯤이면 눈이 떠져요.

## 2. 핸드드립 커피

원두를 갈고, 물을 끓이고, 천천히 붓는 5분이 생각보다 큰 위로가 됩니다.

## 3. 동네 한 바퀴

이어폰 없이 걷는 30분. 새로 생긴 가게를 발견하는 재미도 있어요.

---

여러분의 주말 루틴은 무엇인가요?
`,
  }),
  sample({
    id: 'sample0trv01',
    slug: '샘플-강릉-당일치기-여행',
    title: '[샘플] KTX로 다녀온 강릉 당일치기 코스',
    excerpt: '아침 KTX를 타고 강릉에 도착해 바다, 커피거리, 시장까지. 하루 만에 알차게 돌아본 강릉 당일치기 동선을 정리했다.',
    category: 'travel',
    tags: ['강릉', '당일치기', 'KTX', '바다'],
    cover: { src: '/placeholders/travel.svg', alt: '바다와 언덕 풍경을 표현한 일러스트' },
    publishedAt: daysAgo(10),
    place: {
      name: '강릉 안목해변 일대(샘플)',
      region: '강원 강릉',
      address: '',
      mapUrl: 'https://www.google.com/maps',
      rating: 5,
      priceRange: '교통비 왕복 약 5만원대(샘플)',
      visitedAt: daysAgo(12).slice(0, 10),
    },
    body: `> 이 글은 **샘플 글**입니다. 일정과 비용은 예시입니다.

## 오전: 바다부터

강릉역에 내려 버스를 타고 바로 바다로 향했어요. 평일 오전이라 해변이 한산했습니다.

## 점심: 시장 구경

중앙시장에서 이것저것 맛보다 보면 따로 식당을 갈 필요가 없을 정도예요.

## 오후: 커피거리

해변을 따라 늘어선 카페 중 한 곳에 앉아 바다를 보며 쉬었습니다.

## 동선 요약

1. 강릉역 도착
2. 해변 산책
3. 중앙시장 점심
4. 커피거리에서 휴식
5. 저녁 KTX로 귀가

유튜브 링크를 한 줄에 단독으로 붙여넣으면 이렇게 영상이 들어갑니다(예시 링크).

https://www.youtube.com/watch?v=aqz-KE-bpKQ
`,
  }),
];
