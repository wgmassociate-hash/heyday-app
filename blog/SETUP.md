# www.heydaystar.co.kr 블로그 세팅 (까페24 WP)

앱: **https://app.heydaystar.co.kr**  
블로그: **https://www.heydaystar.co.kr**

---

## 1. 까페24에서 확인 (5분)

1. **도메인** → `www`는 **워드프레스(까페24 호스팅)** 로 연결
2. **`app`** CNAME은 Render (`heyday-app.onrender.com`) — **건드리지 않기**
3. WP 관리자: `https://www.heydaystar.co.kr/wp-admin`

---

## 2. WP 기본 설정 (10분)

| 메뉴 | 설정 |
|------|------|
| 설정 → 일반 | 사이트 제목: `heydaystar` / 설명: `연애·심리, 카톡으로 읽는 관계` |
| 설정 → 읽기 | 홈: **최신 글** / 글 목록: **10개** |
| 설정 → 고유주소 | **글 이름** (`/%postname%/`) |
| 설정 → 토론 | 댓글 **끄기** (운영 부담 줄이기) |

---

## 3. 메뉴 구조

**외모 → 메뉴** 에서 새 메뉴 `메인` 생성:

| 순서 | 라벨 | 링크 |
|------|------|------|
| 1 | 홈 | `/` |
| 2 | 연애·썸 | 카테고리 `연애·썸` |
| 3 | 카톡·대화 | 카테고리 `카톡·대화` |
| 4 | **카톡 분석기** | `https://app.heydaystar.co.kr` (새 탭) |
| 5 | 소개 | 고정 페이지 `소개` |

메뉴 위치: **Primary / 헤더** 에 할당.

---

## 4. 카테고리 (3~4개만)

| 슬러그 | 이름 |
|--------|------|
| `love` | 연애·썸 |
| `kakao` | 카톡·대화 |
| `mind` | 연애 심리 |
| `tips` | 실전 팁 |

---

## 5. 고정 페이지 2개

### 소개 (`/about`)

```
heydaystar는 연애·심리를 카카오톡 대화 패턴으로 풀어보는 블로그입니다.

카톡만으로는 헷갈리는 썸, 밀당, 호감 신호를
글로 이해하고, AI 분석기로 객관적으로 확인해 보세요.

🔗 카톡 대화 분석: https://app.heydaystar.co.kr
```

### 개인정보·면책 (`/privacy`) — AdSense·신뢰용 짧게

```
본 블로그 글은 일반적인 연애·심리 참고용이며 전문 상담을 대체하지 않습니다.
카톡 분석기(app.heydaystar.co.kr)는 대화를 서버에 저장하지 않으며 브라우저에서 익명화 후 분석합니다.
```

---

## 6. 앱 배너 넣기

`blog/snippets/app-cta-banner.html` 내용을:

- **외모 → 위젯 → 사용자 정의 HTML** → 사이드바 또는 글 하단
- 또는 **각 글 본문 맨 아래**에 HTML 블록으로 붙여넣기

---

## 7. 첫 글 2편 올리기

| 파일 | 제목 | 카테고리 |
|------|------|----------|
| `posts/01-kakao-some-signals.md` | 썸일 때 카톡에서 먼저 보는 5가지 신호 | 연애·썸 |
| `posts/02-analyzer-guide.md` | 카톡 대화 AI 분석기 쓰는 법 (heydaystar) | 카톡·대화 |

WP **새 글** → 본문 복사 → **제목·카테고리·대표 이미지** 설정 → 발행.

---

## 8. AdSense (블로그)

- 이미 승인된 계정이면 **www** 사이트 그대로 사용
- **app** 은 AdSense → **사이트** → **사이트 추가** → `app.heydaystar.co.kr` (앱용, 나중에)

---

## 9. 블로그 ↔ 앱 연결 체크리스트

- [ ] 메뉴에 「카톡 분석기」→ app 링크
- [ ] 첫 글 2편 발행
- [ ] 글 하단 앱 CTA 배너
- [ ] app 사이트 SeoContent 「더 알아보기」는 블로그 링크 추가 (선택)

---

## 10. Google Search Console

### 글을 전부 지운 뒤 순서

1. **휴지통 비우기** — 글 → 휴지통 → **비우기** (예전 URL이 색인에 남지 않게)
2. **고정 페이지** `소개`, `개인정보·면책` 발행 (5번 섹션)
3. **글 2편 이상** 재발행 (7번 — 레포 `blog/posts/` 복사)
4. 그다음 Search Console 등록·사이트맵 제출

> 빈 블로그만 등록하면 색인할 페이지가 없어서 GSC 데이터가 거의 안 쌓입니다.

### 속성 추가 (권장: URL 접두어 2개)

| 속성 | URL | 인증 |
|------|-----|------|
| 블로그 | `https://www.heydaystar.co.kr` | HTML 태그 또는 **Site Kit** 플러그인 |
| 앱 | `https://app.heydaystar.co.kr` | HTML 태그 (Render 배포 후 `index.html` head) |

도메인 전체(`heydaystar.co.kr`) 한 번에 쓰려면 **DNS TXT** — 까페24 DNS에서 `google-site-verification=...` 추가.

### 사이트맵 제출

| 사이트 | 사이트맵 URL |
|--------|----------------|
| 블로그 (WP 기본) | `https://www.heydaystar.co.kr/wp-sitemap.xml` |
| 앱 | `https://app.heydaystar.co.kr/sitemap.xml` |

GSC → **색인 생성 → Sitemaps** → 위 URL 입력 → 제출.

### WP에서 Site Kit (가장 쉬움)

1. 플러그인 → **Site Kit by Google** 설치·활성화
2. Google 계정 연결 → Search Console + Analytics 한 번에 연동
3. 사이트맵은 Site Kit이 `wp-sitemap.xml` 자동 인식

### 등록 후 확인

- **URL 검사** → `https://www.heydaystar.co.kr/` 및 대표 글 1개 → **색인 생성 요청**
- **페이지** → 며칠 뒤 색인·노출 수 확인
- 앱은 홈(`/`) 1페이지만 색인하면 충분 (도구형 SPA)
