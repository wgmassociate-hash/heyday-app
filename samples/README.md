# 테스트용 카톡 대화 샘플

분석기 입력창에 **전체 복사 → 붙여넣기** 하세요.

| 파일 | 기대 결과 |
|------|-----------|
| `01-romantic-some.txt` | 연애·썸 관계, 호감 분석, 구체적 대화 인용 |
| `02-friends-gaming.txt` | **친구 관계** (썸 X), 게임·치킨·헬스 주제 |

## 확인 포인트

- 결과 상단 **「· Claude AI」** 표시 → API 연동 성공
- `01` → relationTag에 "썸" 또는 "호감" 계열
- `02` → "친구·동료 관계", #게임 태그, 연애 조언 없음

## 실행

```bash
cd ~/Projects/heydaystar-kakao-analyzer
npm run dev
```

http://localhost:5173
