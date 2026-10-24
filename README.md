# 🍙 수돌이의 맛집 일상 여행 블로그

Astro(SSR) + Netlify Blobs 로 만든 1인 블로그입니다. 외부 DB·유료 서비스 없이 Netlify 무료 플랜 안에서 운영하도록 설계했습니다.

---

## 1. 아키텍처와 선택 이유

- **Astro SSR + @astrojs/netlify**: 모든 공개 페이지를 서버에서 완성된 HTML로 렌더링(검색엔진·애드센스 크롤러가 본문을 그대로 읽음). 공개 페이지의 JS는 다크모드 토글·링크 복사·유튜브 로딩 정도만.
- **Netlify Blobs**: 글·설정·이미지를 저장. `src/lib/storage/` 한 곳에서만 접근하므로 R2·S3 등으로 드라이버만 바꾸면 됩니다.
- **CDN 영구 캐시 + 태그 퍼지**: 공개 페이지는 `Netlify-CDN-Cache-Control: durable, s-maxage=1년` 으로 캐시해 같은 페이지는 사실상 1번만 함수가 실행되고, 글·설정을 저장할 때 `Netlify-Cache-Tag` 로 한 번에 갱신합니다(재빌드·재배포 없음).
- **브라우저 이미지 처리**: 업로드 전에 1600px·WebP로 줄이고 480/960px 축소본도 만들어 `srcset` 으로 제공 → 대역폭 절약.
- **Tailwind CSS v4 + Pretendard 자체 호스팅(동적 서브셋)**: 외부 폰트 요청 없음.

## 2. 폴더 구조

```
sudol-blog/
├─ astro.config.mjs          Astro 설정 (SSR, Netlify 어댑터, Tailwind)
├─ netlify.toml              빌드 명령, 정적 파일 헤더
├─ .env.example              환경변수 예시
├─ scripts/
│  ├─ hash-password.mjs      관리자 비밀번호 해시 생성
│  └─ gen-secret.mjs         SESSION_SECRET 생성
├─ public/
│  ├─ favicon.svg
│  ├─ fonts/pretendard/      Pretendard 동적 서브셋 woff2 (OFL 라이선스 포함)
│  └─ placeholders/          샘플 글용 SVG 일러스트
└─ src/
   ├─ middleware.ts          관리자 인증·CSRF·보안 헤더·noindex
   ├─ lib/
   │  ├─ storage/            ★ 저장소 추상화 (index / netlify / fs)
   │  ├─ content.ts          글·설정·카테고리 저장/조회, 검색, 관련 글
   │  ├─ cache.ts            CDN 캐시 헤더·퍼지
   │  ├─ auth.ts             bcrypt 검증, 서명 쿠키 세션, CSRF, 로그인 시도 제한
   │  ├─ markdown/           마크다운 렌더(목차·이미지·유튜브) + XSS 정화
   │  ├─ media.ts            이미지 주소 규칙(srcset), 형식 검사
   │  ├─ validate.ts         서버측 입력 검증
   │  ├─ seed.ts             기본 설정·카테고리·샘플 글
   │  └─ site.ts, util.ts, env.ts, api.ts, types.ts
   ├─ layouts/ Base.astro(공개), Admin.astro(관리자)
   ├─ components/            헤더, 카드, 장소 카드, 목차, 광고 슬롯, SEO 등
   ├─ admin/                 관리자 브라우저 스크립트(에디터, 이미지 처리, 백업)
   ├─ styles/                global.css(디자인 토큰·본문 타이포), admin.css
   └─ pages/
      ├─ index, posts, search, about, contact, privacy, 404, 500
      ├─ post/[slug], category/[slug], tag/[tag]
      ├─ rss.xml, sitemap.xml, robots.txt, ads.txt, media/[...key]
      ├─ admin/ login, index(글 목록), posts/new, posts/[id], categories, settings, data
      └─ api/admin/ login, logout, posts, upload, categories, tags, settings, samples, export, import, media
```

### 디자인 기준 (에디토리얼 블로그 공통 패턴 정리)
잘 만든 블로그·매거진형 사이트의 공통점을 정리해 적용했습니다(특정 사이트의 코드·이미지·문구는 사용하지 않음).
- 본문은 한 단 680px, 큰 줄간격(1.9), 한국어 줄바꿈 `keep-all` → 오래 읽어도 편함
- 제목 위에 카테고리, 아래에 작성자·날짜·읽는 시간 (신뢰감 + 훑어보기)
- 대표 이미지는 크게, 목록은 3:2 사진 카드 그리드 (사진 중심)
- 헤더는 얇고 고정, 장식 최소화 / 글 끝에 작성자 박스 → 이전·다음 → 관련 글로 다음 읽을거리 연결
- 포인트 컬러 1개(감 주황 `#c2410c`) + 따뜻한 중립색, 다크 모드, 텍스트 로고 `🍙 수돌이.log`

## 3. 주요 기능 요약

| 영역 | 내용 |
| --- | --- |
| 공개 | 홈(최신 글 히어로 → 카테고리별 최신 3개 → 소개 박스), 전체/카테고리/태그 목록(페이지네이션), 글 상세(목차·장소 카드·태그·링크 복사·이전/다음·관련 글), 검색, 소개, 연락처, 개인정보처리방침, 404 |
| SEO | title/description, OG·트위터 카드, canonical, JSON-LD(BlogPosting·Breadcrumb·WebSite), sitemap.xml, robots.txt, RSS |
| 광고 | 상단·중간·하단·사이드바 슬롯 컴포넌트(기본 비활성, 높이 고정으로 CLS 방지), 클라이언트 ID 입력 시 스크립트·ads.txt 자동 활성화 |
| 관리자 | 로그인, 글 목록(검색·상태·카테고리 필터·정렬), 마크다운 에디터+실시간 미리보기+툴바, 사진 드래그&드롭/붙여넣기/선택 업로드, 임시저장·발행·예약 발행, 대표 이미지·alt, 장소 정보, 카테고리·태그 관리, 블로그 설정, 백업/복원(JSON·마크다운 zip), 샘플 글 일괄 삭제, 안 쓰는 이미지 정리 |
| 보안 | bcrypt, IP·전체 로그인 시도 제한, HttpOnly+Secure+SameSite=Strict 서명 쿠키(12시간), 로그아웃 시 모든 세션 무효화, CSRF 토큰+Origin 확인, 서버측 입력 검증, 원시 HTML 이스케이프+sanitize, 업로드 형식(바이트 검사)·용량 제한, /admin noindex |

## 4. 환경변수

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `ADMIN_ID` | ✅ | 관리자 로그인 아이디 |
| `ADMIN_PASSWORD_HASH` | ✅ | `npm run hash-password` 결과(`b64:...`). 비밀번호 원문은 어디에도 넣지 않음 |
| `SESSION_SECRET` | ✅ | 세션 서명 키, 32자 이상 무작위 (`npm run gen-secret`) |
| `SITE_URL` | 선택 | 대표 주소(예: `https://sudol.kr`). 비우면 Netlify의 `URL`(연결한 기본 도메인) 사용 |
| `STORAGE_DRIVER` | 선택 | `fs` 또는 `netlify`. 기본: 로컬 개발 `fs`(.data 폴더), 배포 `netlify` |

`.env.example` 을 `.env` 로 복사해 로컬에서 씁니다. `.env` 는 Git에 올리지 마세요.

## 5. 로컬 실행

필요: Node.js 22 이상

```bash
npm install
cp .env.example .env
npm run hash-password      # 비밀번호 두 번 입력 → 출력된 b64:... 를 .env 의 ADMIN_PASSWORD_HASH 에
npm run gen-secret         # 출력값을 .env 의 SESSION_SECRET 에
npm run dev                # http://localhost:4321  (관리자: /admin)
```

- 로컬에서는 데이터가 프로젝트의 `.data/` 폴더에 저장됩니다. 처음 접속하면 기본 카테고리 3개와 샘플 글 4개가 자동 생성돼요. 초기화하려면 `.data` 폴더를 지우세요.
- 타입 검사: `npm run check` / 운영 빌드: `npm run build`

## 6. 배포 (GitHub → Netlify)

1. **GitHub 저장소 만들기**: 이 폴더에서
   ```bash
   git init && git add . && git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/<내아이디>/sudol-blog.git
   git push -u origin main
   ```
2. **Netlify 연결**: app.netlify.com → *Add new project* → *Import an existing project* → GitHub → 저장소 선택. 빌드 설정은 `netlify.toml` 이 자동으로 채웁니다(Build command `npm run build`, Publish `dist`).
3. **환경변수 설정**: *Project configuration → Environment variables* 에서 `ADMIN_ID`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` 추가 (Scopes: All, 값은 Secret 체크 권장). 이후 *Deploys → Trigger deploy* 로 한 번 다시 배포.
4. **관리자 비밀번호 해시 만들기**: 내 컴퓨터에서 `npm run hash-password` → 나온 `b64:...` 전체를 복사해 붙여넣기. 비밀번호를 바꿀 때도 같은 방법으로 값만 교체 후 재배포.
5. **첫 로그인**: `https://<사이트>.netlify.app/admin` → 블로그 설정에서 연락 이메일·소개 입력.
6. **구입한 도메인 연결**: *Domain management → Add a domain* → 도메인 입력.
   - 도메인 업체(가비아, 후이즈 등) DNS에서 **루트 도메인**: `A` 레코드 `@ → 75.2.60.5`, **www**: `CNAME www → <사이트>.netlify.app` (Netlify 화면에 표시되는 값이 기준). 또는 네임서버를 Netlify DNS로 바꿔도 됩니다.
   - 연결되면 Netlify가 HTTPS(Let's Encrypt)를 자동 발급합니다. *Set as primary domain* 으로 대표 도메인을 정하면 `URL` 환경값이 바뀌어 canonical·sitemap 주소에 자동 반영(필요하면 `SITE_URL` 로 고정).
7. **검색 노출**: Google Search Console에 도메인 등록 → `sitemap.xml` 제출.
8. **애드센스**: ① 샘플 글 삭제(관리자 → 데이터 관리) ② 직접 쓴 글 충분히 발행 ③ 연락 이메일·소개 작성 ④ 애드센스 신청 → 받은 `ca-pub-...` 를 블로그 설정에 입력 → `/ads.txt` 확인 ⑤ 승인 후 광고 단위를 만들고 슬롯 ID를 위치별로 입력.

## 7. 알려진 한계 · 가정 · 트래픽이 늘면

**가정**
- 운영자 1명, 동시 편집 없음(같은 글을 두 기기에서 고치면 저장 시 충돌 경고).
- 글 URL은 한글 슬러그(`/post/성수동-파스타-맛집`). 카테고리 주소는 영문(`food`, `daily`, `travel`).
- 기본 로고 이모지 🍙, 프로필 기본 이모지 🐻, 포인트 컬러 감 주황 — 설정/코드에서 변경 가능.
- 개인정보처리방침 시행일 2026-10-24, 일반적인 1인 블로그 기준 문안(법률 자문 아님).

**알려진 한계**
- 글을 저장하면 공개 페이지 캐시 전체를 퍼지합니다(단순·정확). 글이 수천 개가 되어도 문제는 없지만 저장 직후 첫 방문들은 함수가 다시 실행됩니다.
- 글 목록 인덱스(`meta/index.json`) 하나를 읽어 목록·검색을 만들므로 글 수천 개까지가 적정 범위. 검색은 단순 포함 검색(형태소 분석 없음).
- 삭제/교체된 이미지는 CDN에 최대 1년 남을 수 있고, 글 삭제 시 이미지는 자동 삭제되지 않습니다(데이터 관리 → "안 쓰는 이미지 찾기"로 정리).
- iOS 일부 버전처럼 WebP 인코딩을 못 하는 브라우저에서는 JPEG로 저장됩니다. HEIC를 디코딩 못 하는 브라우저에서는 JPG로 바꿔 올려야 합니다.
- 예약 발행 글은 정확히 그 시각이 아니라 그 시각 이후 첫 방문 때 반영됩니다(캐시 만료 시각을 예약 시각에 맞춰둠).
- 로컬 개발에서는 CDN 캐시·퍼지가 동작하지 않습니다(실제 배포에서만).
- 댓글·조회수 통계 없음(필요하면 Google Analytics나 giscus 등을 추가).

**트래픽이 늘면**
1. Netlify 사용량(Usage)에서 대역폭·함수 호출을 확인. 대부분 이미지 대역폭이 원인 → 이미지 저장소를 Cloudflare R2(+무료 egress)로 옮기기: `src/lib/storage/` 에 R2 드라이버 추가 후 `media` 저장소만 교체.
2. 데이터 관리 → 마크다운 zip 내보내기로 백업 후 Cloudflare Pages, Vercel 등 다른 호스팅으로 이전 가능(Astro 어댑터만 교체).
3. 글이 수천 개를 넘으면 인덱스를 카테고리/연도별로 나누거나 SQLite(Turso 등)로 이전.
4. 검색이 중요해지면 Pagefind 같은 정적 검색 인덱스나 Algolia 도입.
5. 정기적으로 JSON 백업을 내려받아 보관하세요.
