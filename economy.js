// =====================================================
//  경제 시스템 정의: 경매 아이템, 다크넷 서비스 (카지노는 casino.js)
//  단위: 만 크레딧
// =====================================================

// 경매 아이템 (매일 밤 5건이 경매에 오름. 낙찰 즉시 내 것)
//  cat: hack(해킹 · 메신저에 작용) / defense(방어) / info(정보·기타)
//  price: 시작가 (실제 가격은 경매로 결정)
//  target: none(바로 발동) / player(대상 1명) / forge(사칭할 사람 + 받는 사람 + 문장)
//          / text(문장만) / deepfake(문구 + 대상)
//  when: now(낙찰·사용 즉시 ~ 오늘 밤 끝까지) / tonight(오늘 밤 판정) / morning(아침에 결과)
//        / tomorrow(다음 날 투표) / multi(여러 날)
//  pitch: 경매사가 이 물건을 소개할 때 하는 말
const ITEMS = {
  // ----- 해킹: 1:1 메신저에 작용 -----
  wiretap:  { name: "채팅 도청",        cat: "hack",    price: 30, target: "player",   when: "now",      desc: "대상의 오늘 밤 1:1 대화를 몰래 읽음 (이미 나눈 대화 포함)", pitch: "누구의 속삭임이든 당신 귀에 그대로 들어갑니다." },
  scramble: { name: "채팅 교란",        cat: "hack",    price: 20, target: "player",   when: "now",      desc: "대상이 오늘 밤 보내는 1:1 메시지의 글자 일부가 깨져서 전달됨", pitch: "중요한 말일수록 엉망이 되겠죠." },
  block:    { name: "통신 차단",        cat: "hack",    price: 30, target: "player",   when: "now",      desc: "대상은 오늘 밤 남은 시간 동안 1:1 메시지를 보낼 수 없음", pitch: "오늘 밤, 그 사람의 입을 막아 드립니다." },
  forge:    { name: "메시지 위조",      cat: "hack",    price: 40, target: "forge",    when: "now",      desc: "다른 사람 이름으로 원하는 상대에게 1:1 메시지 1통 발송", pitch: "남의 이름으로 한마디. 믿을지는 받는 사람 몫이죠." },
  commlog:  { name: "통신 기록 열람",   cat: "hack",    price: 20, target: "player",   when: "morning",  desc: "대상이 오늘 밤 누구와 대화했는지 목록 확인 (내용은 못 봄 · 아침에 결과)", pitch: "무슨 말을 했는지는 몰라도, 누구와 했는지는 알 수 있습니다." },
  speaker:  { name: "선내 스피커 해킹", cat: "hack",    price: 40, target: "text",     when: "morning",  desc: "내일 아침 방송에 출처 불명 메시지 1줄을 모두에게 송출", pitch: "내일 아침, 배 전체가 당신의 목소리를 듣게 됩니다. 물론 익명으로." },
  // ----- 방어 -----
  armor:    { name: "피하 장갑",        cat: "defense", price: 30, target: "none",     when: "tonight",  desc: "오늘 밤 받는 피해 1 무효", pitch: "칼날 한 번쯤은 거뜬히 막아내는 인공 피부입니다." },
  proxy:    { name: "프록시",           cat: "defense", price: 30, target: "none",     when: "tonight",  desc: "오늘 밤 나를 향한 능력·지목이 다른 랜덤 1명에게 튕겨 나감", pitch: "누가 당신을 노리든, 엉뚱한 사람에게 가게 됩니다." },
  firewall: { name: "방화벽",           cat: "defense", price: 20, target: "none",     when: "tonight",  desc: "오늘 밤 넷러너·화이트햇·인포브로커와 채팅 해킹(도청·교란·차단·위조·기록 열람)을 차단", pitch: "해커들에게는 악몽 같은 물건이죠." },
  decoy:    { name: "홀로그램 디코이",  cat: "defense", price: 20, target: "none",     when: "tonight",  desc: "오늘 밤 나에 대한 조사가 \"시민\"으로 나옴", pitch: "조사관 눈에는 평범한 승객으로 보일 겁니다." },
  // ----- 정보·기타 -----
  scanner:  { name: "생체 스캐너",      cat: "info",    price: 20, target: "player",   when: "morning",  desc: "대상의 정확한 남은 체력 확인 (아침에 결과)", pitch: "겉으론 멀쩡해 보여도, 스캐너는 속이지 못합니다." },
  translog: { name: "송금 로그",        cat: "info",    price: 20, target: "none",     when: "morning",  desc: "오늘 밤 오간 모든 송금 기록 확인 (아침에 결과)", pitch: "돈의 흐름을 보면 사람의 속셈이 보이죠." },
  deepfake: { name: "딥페이크 속보",    cat: "info",    price: 50, target: "deepfake", when: "morning",  desc: "내일 아침 발표에 가짜 사건 1줄 추가 (게임당 1회)", pitch: "한 판에 단 한 번 나오는 물건. 진실을 조작해 보시겠습니까?" },
  bribe:    { name: "뇌물",             cat: "info",    price: 30, target: "none",     when: "tomorrow", desc: "내일 투표에서 내 표가 2표로 집계", pitch: "내일 투표에서 당신의 목소리가 두 배로 커집니다." },
  miner:    { name: "크립토 채굴기",    cat: "info",    price: 30, target: "none",     when: "multi",    desc: "앞으로 3일 동안 낮마다 +15만", pitch: "지금 사 두면 사흘 동안 알아서 돈을 벌어 옵니다." },
};

// 딥페이크로 고를 수 있는 문구 (실제 발표와 똑같은 모양만)
const DEEPFAKE_TEMPLATES = {
  injured: (name) => name + "가 부상을 입었다!",
  healed: (name) => "리퍼닥이 " + name + "을(를) 치료했다!",
};

// 다크넷 서비스 (경매와 별개. 언제든 정가로 구매)
//  - 하룻밤 2건까지
//  - 한 번 쓴 서비스는 다음부터 가격 ×1.5 (게임 끝까지 누적)
const SERVICES = {
  drone:    { name: "의료 드론",              price: 40,  target: false, desc: "내 부상 1 회복 (오늘 밤 피해도 막음). 체력이 가득이면 구매 불가" },
  track:    { name: "인포브로커 · 행동 추적", price: 30,  target: true,  desc: "대상이 오늘 밤 누구를 지목했는지 (아침에 결과)" },
  census:   { name: "인포브로커 · 승객 명부", price: 50,  target: false, desc: "현재 생존한 신디케이트 수 (아침에 결과)" },
  contract: { name: "청부업자",               price: 100, target: true,  minDay: 2, desc: "대상에게 1 피해 (2일차 밤부터)" },
};
const SERVICE_NIGHT_LIMIT = 2;
const SERVICE_PRICE_RATE = 1.5;

// n번 쓴 뒤의 가격 (40 → 60 → 90 → 135 …)
function servicePrice(id, uses) {
  return Math.round(SERVICES[id].price * Math.pow(SERVICE_PRICE_RATE, uses || 0));
}

// 경매 규칙
const AUCTION = {
  lots: 5, // 하룻밤 출품 수
  lotSeconds: Number(process.env.AUCTION_LOT_SECONDS) || 20, // 건당 시간 (연장 없음)
  gapSeconds: 2, // 건 사이 쉬는 시간 (낙찰 연출)
  startDelay: 3, // 밤이 시작되고 첫 경매까지
  winLimit: 2, // 1인당 하룻밤 낙찰 한도
};
// 최소 입찰 단위: 시작가의 10% (최소 2만)
function bidStep(item) {
  return Math.max(2, Math.round(item.price * 0.1));
}

const MINER_INCOME = 15;
const MINER_TURNS = 3;

module.exports = {
  ITEMS, DEEPFAKE_TEMPLATES, SERVICES, SERVICE_NIGHT_LIMIT, servicePrice, AUCTION, bidStep,
  MINER_INCOME, MINER_TURNS,
};
