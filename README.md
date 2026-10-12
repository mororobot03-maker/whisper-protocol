# 위스퍼 프로토콜 (Whisper Protocol)

카지노 비행선 "레비아탄"에서 벌어지는 사이버펑크 마피아 게임. Node.js + Express + Socket.IO.

하루 흐름 (v2): 1일차 낮 → 밤 → 아침(CCTV) → 낮 → 투표(2일차부터) → … → 착륙
- 낮: 카지노 6종(하루 10판, 돈을 잃지 않음) · 그룹 채팅 · 송금
- 밤: 직업 능력 · 1:1 메신저(통행금지) · 경매장(5건 × 20초) · 다크넷 · 송금

## 내 컴퓨터에서 실행

```
npm install
node server.js
```
브라우저에서 http://localhost:3000 (같은 와이파이의 다른 기기는 http://내PC_IP:3000)

내 컴퓨터에서는 2명부터 시작할 수 있어요 (테스트용). 온라인(Render)에서는 4명부터.

## 온라인 배포 (Render 무료)

1. GitHub에 이 폴더 내용을 올린다 (`node_modules`는 빼고. `package.json`이 저장소 맨 위에 있어야 함)
2. render.com → New → Blueprint → 저장소 선택 → Apply
   (render.yaml을 읽어서 설정이 자동으로 채워짐)
3. 발급된 `https://whisper-protocol-xxxx.onrender.com` 주소를 친구들에게 공유

무료 요금제 특징
- 15분 동안 아무도 접속하지 않으면 잠들고, 다음 접속 때 깨어나는 데 약 1분 걸림
- 게임 중에는 계속 통신하므로 잠들지 않음
- 서버가 재시작되면 진행 중인 방은 사라짐 (저장 기능 없음)

## 테스트용 환경 변수
| 이름 | 뜻 |
|---|---|
| `PORT` | 서버 포트 (Render가 자동으로 정함) |
| `MIN_PLAYERS` | 최소 인원 |
| `FAST_SECONDS` | 모든 단계를 이 초로 (빠른 테스트) |
| `START_CREDITS` | 시작 자금 강제 |
| `AUCTION_ITEMS` | 경매 출품 강제 (예: `wiretap,forge`) |
| `AUCTION_LOT_SECONDS` | 경매 건당 시간 (기본 20초) |
