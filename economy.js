// =====================================================
//  경제 시스템 정의: 암상인 아이템, 다크넷 서비스, 도박
//  단위: 만 크레딧
// =====================================================

// 암상인 아이템 (전부 1회용, 공용 재고 1개, 매일 밤 랜덤 진열)
//  target: none(대상 없음) / player(1명 지정) / deepfake(문구 + 대상)
//  when: tonight(오늘 밤 효과) / tomorrow(다음 날 낮 효과) / morning(아침에 결과)
const ITEMS = {
  proxy:    { name: "프록시",          price: 40, target: "none",     desc: "오늘 밤 나를 향한 지목이 다른 랜덤 1명에게 돌아감" },
  firewall: { name: "방화벽",          price: 30, target: "none",     desc: "오늘 밤 넷러너, 화이트햇, 인포브로커 차단" },
  armor:    { name: "피하 장갑",       price: 60, target: "none",     desc: "오늘 밤 받는 피해 1 무효" },
  decoy:    { name: "홀로그램 디코이", price: 40, target: "none",     desc: "오늘 밤 나에 대한 조사가 \"시민\"으로 나옴" },
  launder:  { name: "돈세탁",          price: 20, target: "none",     desc: "오늘 밤 내 송금이 송금 로그에 안 찍힘" },
  scanner:  { name: "생체 스캐너",     price: 50, target: "player",   desc: "대상의 정확한 남은 체력 확인 (아침에 결과)" },
  translog: { name: "송금 로그",       price: 30, target: "none",     desc: "오늘 밤 모든 송금 기록 확인 (아침에 결과)" },
  wiretap:  { name: "도청기",          price: 30, target: "player",   desc: "내일 독대 1라운드에서 대상의 대화를 몰래 청취" },
  mask:     { name: "보이스 마스크",   price: 30, target: "none",     desc: "내일 독대 1라운드에서 상대에게 내 이름이 ???로 보임" },
  jammer:   { name: "재머",            price: 40, target: "player",   desc: "대상의 내일 독대 1라운드를 무음 처리" },
  deepfake: { name: "딥페이크 속보",   price: 70, target: "deepfake", desc: "내일 아침 발표에 가짜 문구 1줄 추가 (게임당 1회)" },
  bribe:    { name: "뇌물",            price: 50, target: "none",     desc: "내일 내 투표가 2표로 집계" },
  miner:    { name: "크립토 채굴기",   price: 30, target: "none",     desc: "3턴 동안 매 턴 +15" },
};

// 딥페이크로 고를 수 있는 문구 (실제 발표와 똑같은 모양만)
const DEEPFAKE_TEMPLATES = {
  injured: (name) => name + "가 부상을 입었다!",
  healed: (name) => "리퍼닥이 " + name + "을(를) 치료했다!",
};

// 다크넷 서비스 (누구나, 재고 제한 없음, 개인 쿨다운)
//  cooldown: 사용 후 며칠 뒤에 다시 쓸 수 있는지 / group: 같은 그룹은 쿨다운 공유
const SERVICES = {
  track:    { name: "인포브로커 · 행동 추적", price: 30, cooldown: 2, group: "info", target: true, desc: "대상이 오늘 밤 누구를 지목했는지 (아침에 결과)" },
  census:   { name: "인포브로커 · 승객 명부", price: 40, cooldown: 2, group: "info", target: false, desc: "현재 생존한 신디케이트 수 (아침에 결과)" },
  contract: { name: "청부업자",               price: 100, cooldown: 3, group: "contract", target: true, minDay: 2, desc: "대상에게 1 피해 (2일차 밤부터)" },
  drone:    { name: "의료 드론",              price: 50, cooldown: 2, group: "drone", target: false, desc: "내 부상 1 회복 (오늘 밤 피해도 막음)" },
};

// 도박
const GAMBLES = {
  double:  { name: "룰렛 (더블업)", chance: 0.5, payout: 2 },
  jackpot: { name: "슬롯머신 (잭팟)", chance: 0.1, payout: 8 },
};

const SHOP_SIZE_MIN = 5;
const SHOP_SIZE_MAX = 6;
const MINER_INCOME = 15;
const MINER_TURNS = 3;

module.exports = {
  ITEMS, DEEPFAKE_TEMPLATES, SERVICES, GAMBLES,
  SHOP_SIZE_MIN, SHOP_SIZE_MAX, MINER_INCOME, MINER_TURNS,
};
