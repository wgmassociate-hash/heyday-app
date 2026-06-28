# heydaystar 배포 — 당신이 할 일 3가지만

코드·애드센스 연동·ads.txt는 **이미 앱에 넣어 둠**.  
아래만 하면 `www.heydaystar.co.kr`에 올릴 수 있어요.

---

## ✅ 내가(에이전트) 해 둔 것

- AdSense 광고 컴포넌트 (`AdSlot.jsx`)
- `ads.txt` 자동 생성 (서버가 환경 변수로 만들어 줌)
- Render 배포 설정 (`render.yaml`)
- 프로덕션 서버 (React + API 한 번에)

---

## 📋 당신이 할 일 (순서대로)

### 1단계 — GitHub에 코드 올리기 (10분)

1. https://github.com/new 에서 저장소 만들기 (이름 예: `heydaystar-kakao-analyzer`)
2. 터미널에서:

```bash
cd ~/Projects/heydaystar-kakao-analyzer
git add .
git commit -m "heydaystar 카톡 분석기 MVP"
git branch -M main
git remote add origin https://github.com/본인아이디/heydaystar-kakao-analyzer.git
git push -u origin main
```

> GitHub 계정 없으면 먼저 github.com 가입

---

### 2단계 — Render에 배포 (15분)

1. https://render.com 가입 → **Sign in with GitHub**
2. **New +** → **Web Service**
3. 방금 올린 GitHub repo 선택
4. 설정 (대부분 자동):

| 항목 | 값 |
|------|-----|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |

5. **Environment** (Environment Variables)에 아래 추가:

| Key | Value (예시) | 어디서? |
|-----|--------------|---------|
| `NODE_ENV` | `production` | 그대로 입력 |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic 콘솔 |
| `ADSENSE_PUBLISHER_ID` | `pub-1234...` 또는 `ca-pub-1234...` | AdSense 계정 정보 |
| `VITE_ADSENSE_CLIENT` | `ca-pub-1234...` | AdSense 게시자 ID |
| `VITE_ADSENSE_SLOT_BANNER` | `1234567890` | AdSense 광고 단위 |
| `VITE_ADSENSE_SLOT_RECTANGLE` | `1234567890` | AdSense 광고 단위 (결과 화면 등) |
| `VITE_ADSENSE_SLOT_LEADERBOARD` | `1234567890` | AdSense 광고 단위 |
| `VITE_ADSENSE_SLOT_LOADING` | `1234567890` | AdSense 광고 단위 (**로딩 화면 전용**, 선택) |

> `VITE_ADSENSE_SLOT_LOADING`을 비우면 로딩 화면은 `RECTANGLE` 슬롯을 그대로 씁니다. 로딩 노출만 따로 보려면 AdSense에서 광고 단위를 하나 더 만들고 여기에 넣으세요.

> AdSense ID는 **나중에** 넣어도 됨. 그때까지는 회색 “광고 영역” placeholder만 보임.

6. **Create Web Service** → 5~10분 기다리기
7. `https://heydaystar-xxxx.onrender.com` 주소에서:
   - 사이트 열리는지
   - `/ads.txt` 열리는지 (AdSense ID 넣었을 때)
   - 카톡 분석 한 번 해보기

---

### 3단계 — 도메인 연결 (까페24, 10분)

**2단계 테스트 OK 된 뒤에** 진행하세요.

1. Render → 해당 Web Service → **Settings** → **Custom Domains**
2. `www.heydaystar.co.kr` 추가 → Render가 알려주는 **CNAME** 복사
3. 까페24 → **도메인 관리** → **DNS 설정**
   - 호스트: `www` / 타입: `CNAME` / 값: Render 주소
4. DNS 전파 10분~48시간
5. Render에서 **Verify** → HTTPS 자동 발급
6. **그다음** 까페24 워드프레스 호스팅 해지/초기화

---

## 🔑 AdSense ID 찾는 법 (30초)

1. https://www.google.com/adsense 로그인
2. **계정** → **게시자 ID** → `ca-pub-xxxxxxxx` 복사
3. **광고** → **광고 단위 기준** → 디스play 광고 3개 만들기 → 각각 `data-ad-slot` 숫자 복사

`ADSENSE_PUBLISHER_ID`에는 `ca-pub-...` 그대로 넣어도 됨 (앱이 알아서 `pub-` 형식으로 ads.txt 생성).

---

## ❓ 막히면

- Render 빌드 실패 → Render **Logs** 탭 스크린샷
- 분석 안 됨 → `ANTHROPIC_API_KEY` 확인
- 광고 안 보임 → 며칠 기다림 / AdSense 사이트 상태 확인 / **본인 클릭 금지**

---

## 돈

- Render 무료: 첫 접속 때 잠깐 느릴 수 있음
- Claude API: 분석 1회당 과금 (Anthropic 대시보드에서 확인)
