# 카톡 밀당 감정 분석기

heydaystar (www.heydaystar.co.kr) 메인 루트 배포용 Vite + React + Tailwind CSS SPA + Claude API.

## 1. API 키 설정

```bash
cp .env.example .env
# .env 파일을 열어 ANTHROPIC_API_KEY 입력
```

키 발급: https://console.anthropic.com/

## 2. 개발 실행

```bash
npm install
npm run dev
```

- 프론트: http://localhost:5173
- API 서버: http://localhost:3001 (Vite가 `/api`를 자동 프록시)

API 키 없이도 **로컬 휴리스틱 분석**으로 폴백됩니다.

## 3. 프로덕션 배포

```bash
npm run build
npm start
```

`npm start`는 Express가 `dist/` 정적 파일 + `/api/analyze`를 함께 서빙합니다.

## 보안

- 대화 원문은 브라우저에서 `[인물A]` 등으로 익명화 후 API로 전송
- `ANTHROPIC_API_KEY`는 서버 `.env`에만 보관 (프론트에 노출 금지)

## AdSense

`src/components/AdSlot.jsx` 주석 위치에 광고 코드 삽입.

## OG 이미지

`public/og-image.png` (1200×630px) 추가.
