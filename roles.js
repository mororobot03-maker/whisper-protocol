// =====================================================
//  직업 목록 (도감)
//  team: citizen(시민팀) / syndicate(신디케이트) / third(제3세력)
//  noBan: 금지할 수 없는 직업 (VIP, 블레이드)
//  직업은 게임 시작 때 인원수에 맞춰 랜덤으로 정해짐 (generateRoles)
// =====================================================
const ROLES = {
  vip:       { name: "VIP",       team: "citizen", noBan: true, desc: "체력 3, 매 턴 30 크레딧. 죽으면 시민팀 패배" },
  cyberpol:  { name: "사이버폴",  team: "citizen", desc: "밤에 1명 조사. 직업 2개가 보이는데 하나만 진짜 (신디케이트 1개 + 시민팀 1개)" },
  whitehat:  { name: "화이트햇",  team: "citizen", desc: "밤에 1명의 능력 방해" },
  ripperdoc: { name: "리퍼닥",    team: "citizen", desc: "밤에 1명 치료 (자신 제외)" },
  bodyguard: { name: "경호원",    team: "citizen", desc: "밤에 1명 경호 (자신 제외). 공격을 막아내면 체력은 그대로, 경호 보수 +50만" },
  watcher:   { name: "감시 기사", team: "citizen", desc: "밤에 1명을 지켜보고, 그 사람에게 능력을 쓴 사람 확인" },
  dealer:    { name: "딜러",      team: "citizen", desc: "밤에 1명의 보유 크레딧 확인" },
  double:    { name: "대역 배우", team: "citizen", desc: "VIP가 누군지 알고 시작. 조사와 생체 스캐너에서 VIP로 보임" },
  mercenary: { name: "용병",      team: "citizen", desc: "게임 전체에서 공격 1회(피해 1), 방어 1회(1명의 그날 밤 피해 무효, 자신 가능)" },
  citizen:   { name: "시민",      team: "citizen", auto: true, desc: "능력 없음" },

  // 신디케이트는 모두 밤마다 [공격 투표]와 [자기 특수 능력] 중 하나를 고름
  blade:        { name: "블레이드",  team: "syndicate", noBan: true, desc: "특수 능력 없는 기본 신디케이트. 매일 밤 공격 투표" },
  netrunner:    { name: "넷러너",    team: "syndicate", desc: "공격 투표 또는 해킹 (방해 / 직업 확인) 중 택1" },
  doppelganger: { name: "도플갱어",  team: "syndicate", desc: "조사에서 시민팀 직업으로 보임 (항상 적용)" },
  viper:        { name: "바이퍼",    team: "syndicate", desc: "공격 투표 또는 독 투여 중 택1. 독에 걸리면 다음 날 밤 부상" },
  fixer:        { name: "픽서",      team: "syndicate", desc: "공격 투표 또는 매수 중 택1. 매수당한 사람의 다음 날 투표는 몰래 무효" },
  sponsor:      { name: "스폰서",    team: "syndicate", startBonus: 60, desc: "시작 자금 +60만 (항상 적용). 돈으로 동료를 지원" },

  bounty:   { name: "현상금 사냥꾼", team: "third", desc: "타깃이 투표로 처형되면 단독 승리" },
  stowaway: { name: "밀항자",        team: "third", desc: "착륙까지 생존하면 단독 승리" },
};

const TEAM_NAMES = { citizen: "시민팀", syndicate: "신디케이트", third: "제3세력" };

// 드롭다운 옵션. labels가 있으면 값 대신 그 글자를 보여줌
const OPTIONS = {
  landingDays:   { label: "착륙일",       values: ["auto", 4, 5, 6, 7, 8], unit: "일" },
  daySeconds:    { label: "낮 시간",      values: [90, 120, 150, 180],     unit: "초" },
  nightSeconds:  { label: "밤 시간",      values: [120, 150, 180, 240],    unit: "초" },
  startCredits:  { label: "시작 자금",    values: [0, 20, 30, 50],         unit: "만" },
  revealRole:    { label: "추방 시 직업", values: ["hide", "show"],        labels: { hide: "비공개", show: "공개" } },
};

function defaultSettings() {
  return {
    landingDays: "auto",
    daySeconds: 120,
    nightSeconds: 150,
    startCredits: 30,
    revealRole: "hide",
    bans: [], // 이번 판에 나오지 않게 할 직업
  };
}

// 인원수별 팀 구성 (VIP 1명, 신디케이트 1명 이상은 항상)
//  syndicate: 신디케이트 수 / third: 제3세력이 나올 확률 (금지하지 않은 제3세력이 있을 때) / special: 시민팀 특수 직업 수 [최소, 최대]
function teamPlan(count) {
  if (count <= 5) return { syndicate: 1, third: 0.5, special: [1, 2] };
  if (count <= 6) return { syndicate: 2, third: 0.5, special: [2, 3] };
  if (count <= 8) return { syndicate: 2, third: 0.5, special: [2, 3] };
  return { syndicate: 3, third: 0.5, special: [3, 4] };
}

// 금지하지 않은 직업 = 이번 판에 나올 수 있는 직업
function rolePool(bans, count) {
  return Object.keys(ROLES).filter((id) => {
    const r = ROLES[id];
    if (r.noBan) return true;
    if (bans.includes(id)) return false;
    return true;
  });
}

// 인원수에 맞춰 직업을 랜덤으로 뽑음 → 직업 id 목록 (아직 섞기 전)
function generateRoles(count, bans, rand = Math.random) {
  const pool = rolePool(bans, count);
  const plan = teamPlan(count);
  const take = (list) => list.splice(Math.floor(rand() * list.length), 1)[0];
  const ofTeam = (team) => pool.filter((id) => ROLES[id].team === team && !ROLES[id].auto && id !== "vip");

  const deck = ["vip"];
  // 신디케이트: 남은 특수 직업에서 하나씩, 다 쓰면 블레이드
  const syn = ofTeam("syndicate");
  for (let i = 0; i < plan.syndicate && deck.length < count; i++) deck.push(syn.length ? take(syn) : "blade");
  // 제3세력
  const third = ofTeam("third");
  if (third.length && deck.length < count && rand() < plan.third) deck.push(take(third));
  // 시민팀 특수 직업
  const cit = ofTeam("citizen");
  const [lo, hi] = plan.special;
  const want = lo + Math.floor(rand() * (hi - lo + 1));
  for (let i = 0; i < want && cit.length && deck.length < count; i++) deck.push(take(cit));
  // 나머지는 시민
  while (deck.length < count) deck.push("citizen");
  return deck;
}

function autoLandingDays(count) {
  return Math.min(8, Math.max(4, Math.ceil(count / 2) + 2));
}

module.exports = { ROLES, TEAM_NAMES, OPTIONS, defaultSettings, teamPlan, rolePool, generateRoles, autoLandingDays };
