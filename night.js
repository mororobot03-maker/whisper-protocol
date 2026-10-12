// =====================================================
//  밤 능력 판정
//  1) 누가 무엇을 할 수 있는지 (nightOptions)
//  2) 밤이 끝나면 처리 순서대로 계산 (resolveNight)
//     방어(프록시·방화벽) → 방해 → 공격(독·신디케이트 공격·청부업자) → 경호
//     → 장갑 → 치료(리퍼닥·의료 드론) → 조사
//
//  규칙 요약
//  - 부상(체력이 최대보다 낮음)이어도 능력·아이템 모두 사용 가능 (v2에서 패널티 삭제)
//  - 보디가드가 공격을 대신 막아내면 +30만 크레딧
//  - 신디케이트는 모두 [공격 투표] 또는 [자기 특수 능력] 중 하나를 고름
//    공격은 팀 전체 밤 1회. 표가 한 사람에게 모이면 공격, 갈리면 50% 확률로만 공격
// =====================================================
const { ROLES } = require("./roles");
const { DEEPFAKE_TEMPLATES } = require("./economy");

const BODYGUARD_REWARD = 30; // 경호 성공 보수 (만 크레딧)

// 직업별 밤 행동 정의
//  self: 자기 자신을 고를 수 있는지 / noAlly: 신디케이트 동료는 못 고름
//  pair: 두 명을 고름 / modes: 행동 종류 선택
const ACTIONS = {
  cyberpol:  { label: "조사" },
  whitehat:  { label: "능력 방해" },
  ripperdoc: { label: "치료" },
  bodyguard: { label: "경호" },
  watcher:   { label: "감시" },
  dealer:    { label: "크레딧 확인" },
};

// 신디케이트 특수 능력 (공격 투표 대신 고를 수 있는 것)
//  noAlly: 신디케이트 동료는 못 고름
const SYNDICATE_SPECIALS = {
  netrunner: { modes: { block: "해킹 · 방해", scan: "해킹 · 직업 확인" } },
  viper:     { modes: { poison: "독 투여" }, noAlly: true },
  fixer:     { modes: { fix: "매수" }, noAlly: true },
};

function maxHp(p) {
  return p.role === "vip" ? 3 : 2;
}

// 부상 = 최대 체력보다 낮음
function isInjured(p) {
  return p.hp < maxHp(p);
}

// 이 사람이 오늘 밤 할 수 있는 행동. 못 하면 { reason }
//  modes가 있으면 행동 종류를 고름. modeCandidates[모드] = 그 모드로 고를 수 있는 사람
function nightOptions(game, p) {
  const alive = game.players.filter((t) => t.alive);
  if (!p.alive) return { reason: "사망자는 행동할 수 없습니다." };

  if (p.team === "syndicate") {
    const attackTo = alive.map((t) => t.name); // 자기 자신이나 동료도 고를 수 있음 (시민 교란용)
    const note = "공격은 팀 전체 하루 1회. 표가 한 사람에게 모이면 공격, 갈리면 50% 확률로만 공격합니다.";
    const sp = SYNDICATE_SPECIALS[p.role];
    if (!sp) return { label: "공격 투표", attackOnly: true, candidates: attackTo, note };

    let others = alive.filter((t) => t !== p);
    if (sp.noAlly) others = others.filter((t) => t.team !== "syndicate");
    const modes = { attack: "공격 투표", ...sp.modes };
    const modeCandidates = { attack: attackTo };
    for (const m in sp.modes) modeCandidates[m] = others.map((t) => t.name);
    return { label: "오늘 밤 행동 (하나만)", modes, modeCandidates, candidates: attackTo, note: note + " 특수 능력을 고르면 공격 투표에는 참여하지 않습니다." };
  }

  const act = ACTIONS[p.role];
  if (!act) return { reason: "밤에 할 수 있는 직업 능력이 없습니다." };

  let candidates = alive;
  if (!act.self) candidates = candidates.filter((t) => t !== p);
  return { label: act.label, pair: !!act.pair, modes: null, candidates: candidates.map((t) => t.name), note: "" };
}

// 오늘 밤 이 사람에게 아이템 효과가 걸려 있는지
function hasFx(game, p, key) {
  const set = game.night.effects && game.night.effects[p.id];
  return !!(set && set.has(key));
}

// 조사에 "진짜"로 보이는 직업 id (디코이, 대역 배우, 도플갱어는 위장)
function shownRole(game, t) {
  if (hasFx(game, t, "decoy")) return "citizen";
  if (t.role === "double") return "vip";
  if (t.role === "doppelganger") return game.disguise[t.id];
  return t.role;
}

// 넷러너 조사: 보이는 직업 하나
function appearance(game, t) {
  return ROLES[shownRole(game, t)].name;
}

// 사이버폴 조사: 직업 두 개를 보여주는데 하나만 진짜
//  항상 [신디케이트 직업 1개 + 시민팀 직업 1개] 모양
//  - 신디케이트면 시민팀 직업이 가짜 / 시민팀이면 신디케이트 직업이 가짜
//  - 제3세력은 자기 직업 + 가짜 시민팀 직업
//  가짜는 "이번 판에 나올 수 있는 직업" 중에서 고름
function investigate(game, t, rand = Math.random) {
  const real = shownRole(game, t);
  const team = ROLES[real].team;
  const fakeTeam = team === "citizen" ? "syndicate" : "citizen";
  const pool = (game.pool || Object.keys(ROLES)).filter((id) => ROLES[id].team === fakeTeam && id !== real);
  const fake = pool.length ? pool[Math.floor(rand() * pool.length)] : fakeTeam === "syndicate" ? "blade" : "citizen";
  const pair = rand() < 0.5 ? [real, fake] : [fake, real];
  return pair.map((id) => ROLES[id].name).join(" / ");
}

// =====================================================
//  판정
//  game.night.actions  = { 행동한 사람 id: { target, target2, mode } }  (target은 id)
//  game.night.attackVotes = { 신디케이트 id: 대상 id }  (공격 투표. 팀 전체 하루 1회 공격)
//  game.night.effects  = { id: Set(["proxy", "firewall", "armor", "decoy"]) }
//  game.night.services = [{ type: track|census|contract|drone|scanner|translog, by, target }]
//  game.night.transfers = [{ from, to, amount }]
//  game.night.deepfake = { kind: injured|healed, target: id }
//  rand: 확률 계산 함수 (테스트할 때 바꿔 끼울 수 있게)
//  반환: { lines: 모두에게 발표할 문장, priv: { id: [나만 보는 결과] } }
// =====================================================
function resolveNight(game, rand = Math.random) {
  const night = game.night;
  const find = (id) => game.players.find((p) => p.id === id);
  const events = []; // 공개 발표할 사건 { type: injured|dead|healed, name, text } (화면 애니메이션용)
  const priv = {};
  const tell = (p, text) => (priv[p.id] = priv[p.id] || []).push(text);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // ----- 0. 방어: 프록시 -----
  // 대상이 프록시를 켰으면 실제로는 다른 랜덤 1명에게 감 (행동한 사람은 모름)
  // shown = 행동한 사람이 고른 대상(결과 문구에 쓰는 이름), target = 실제로 효과를 받는 사람
  const redirect = (actor, shown) => {
    if (!hasFx(game, shown, "proxy")) return shown;
    const others = game.players.filter((p) => p.alive && p !== shown && p !== actor);
    return others.length ? pick(others) : shown;
  };

  // 살아있는 사람의 유효한 행동만 모으기
  const acts = [];
  for (const id in night.actions) {
    const actor = find(id);
    const a = night.actions[id];
    const shown = find(a.target);
    if (!actor || !actor.alive || !shown || !shown.alive) continue;
    const target = redirect(actor, shown);
    acts.push({ actor, shown, target, target2: find(a.target2), mode: a.mode });
  }
  const actOf = (role) => acts.find((a) => a.actor.role === role);

  // 신디케이트 공격: 공격 투표로 대상 결정
  let attack = null;
  const makeAttack = (actor, shown) => ({ actor, shown, target: redirect(actor, shown) });
  if (night.attackVotes) {
    const byTarget = {}; // { 대상 id: [투표한 사람들] }
    for (const voterId in night.attackVotes) {
      const v = find(voterId);
      const t = find(night.attackVotes[voterId]);
      if (!v || !v.alive || !t || !t.alive) continue;
      (byTarget[t.id] = byTarget[t.id] || []).push(v);
    }
    const ids = Object.keys(byTarget);
    if (ids.length) {
      const most = Math.max(...ids.map((id) => byTarget[id].length));
      const chosen = find(pick(ids.filter((id) => byTarget[id].length === most))); // 최다 득표 (동점이면 랜덤)
      const voters = ids.flatMap((id) => byTarget[id]);
      const split = ids.length > 1;
      if (split && rand() >= 0.5) {
        for (const v of voters) tell(v, "공격 투표가 갈려 오늘 밤 공격이 무산됐다.");
      } else {
        attack = makeAttack(pick(byTarget[chosen.id]), chosen); // 실제로 움직인 사람은 그 대상에 투표한 사람 중 1명
        if (split) for (const v of voters) tell(v, "공격 투표가 갈렸지만 " + chosen.name + " 공격이 실행됐다.");
      }
    }
  } else if (night.attack) {
    // (예전 방식: 대상 하나를 바로 지정) 테스트용으로 남겨 둠
    const actor = find(night.attack.by);
    const shown = find(night.attack.target);
    if (actor && actor.alive && shown && shown.alive) attack = makeAttack(actor, shown);
  }

  // 다크넷 서비스, 대상이 있는 아이템
  const services = [];
  for (const s of night.services || []) {
    const actor = find(s.by);
    if (!actor || !actor.alive) continue;
    const shown = s.target ? find(s.target) : null;
    if (s.target && (!shown || !shown.alive)) continue;
    services.push({ ...s, actor, shown, target: shown ? redirect(actor, shown) : null });
  }
  const servicesOf = (type) => services.filter((s) => s.type === type);

  // 감시 기사용: 누가 누구를 지목했는지 (실제로 효과를 받은 사람 기준)
  const targetedBy = {};
  const mark = (actor, t) => {
    if (!t || t === actor) return;
    (targetedBy[t.id] = targetedBy[t.id] || new Set()).add(actor.name);
  };
  for (const a of acts) {
    mark(a.actor, a.target);
    mark(a.actor, a.target2);
  }
  if (attack) mark(attack.actor, attack.target);
  for (const s of services) mark(s.actor, s.target);

  // ----- 0. 방어: 방화벽 (해커 능력과 인포브로커 차단) -----
  const firewalled = new Set(); // 방화벽에 막힌 행동
  const checkFirewall = (a) => {
    if (a && hasFx(game, a.target, "firewall")) {
      firewalled.add(a);
      tell(a.actor, a.shown.name + "의 방화벽에 막혔다.");
    }
  };
  for (const a of acts) if (a.actor.role === "whitehat" || a.actor.role === "netrunner") checkFirewall(a);
  for (const s of servicesOf("track")) checkFirewall(s);

  // ----- 1. 방해 -----
  const blocked = new Set(); // 방해당한 사람 id
  let wh = actOf("whitehat");
  let nr = acts.find((a) => a.actor.role === "netrunner" && a.mode === "block");
  if (firewalled.has(wh)) wh = null;
  if (firewalled.has(nr)) nr = null;

  if (wh && nr && wh.target === nr.actor && nr.target === wh.actor) {
    // 서로를 방해하면 둘 다 실패
    tell(wh.actor, "누군가와 해킹이 충돌해 아무 일도 일어나지 않았다.");
    tell(nr.actor, "누군가와 해킹이 충돌해 아무 일도 일어나지 않았다.");
    wh = null;
    nr = null;
  } else {
    // 해커끼리 먼저: 상대 해커를 막으면 그 해커의 방해는 무효
    const whStopped = wh && nr && nr.target === wh.actor;
    const nrStopped = wh && nr && wh.target === nr.actor;
    if (whStopped) wh = null;
    if (nrStopped) nr = null;
    if (wh) blocked.add(wh.target.id);
    if (nr) blocked.add(nr.target.id);
  }

  // 직업 능력이 통하는지 (다크넷 서비스와 아이템은 방해로 못 막음)
  const works = (a) => a && !blocked.has(a.actor.id) && !firewalled.has(a);
  for (const a of [...acts, attack]) {
    if (a && blocked.has(a.actor.id)) tell(a.actor, "능력이 방해받아 실패했다.");
  }

  // ----- 2. 공격 (독, 블레이드, 청부업자) -----
  const dmg = {}; // { id: 받은 피해 }
  const hit = (t) => (dmg[t.id] = (dmg[t.id] || 0) + 1);
  const guard = actOf("bodyguard");

  // 경호: 보디가드가 지키는 사람이 맞으면 대신 맞음
  const strike = (t) => {
    if (works(guard) && guard.target === t) {
      hit(guard.actor);
      guard.actor.credits += BODYGUARD_REWARD;
      tell(guard.actor, t.name + "을(를) 노린 공격을 대신 받아냈다. 경호 보수 +" + BODYGUARD_REWARD + "만");
    } else {
      hit(t);
    }
  };

  // 어젯밤 독이 오늘 밤 터짐 (방해로 막을 수 없음)
  for (const id of game.poisoned || []) {
    const t = find(id);
    if (t && t.alive) hit(t);
  }

  const viper = actOf("viper");
  const newPoison = [];
  if (works(viper)) {
    newPoison.push(viper.target.id);
    tell(viper.actor, viper.shown.name + "에게 독을 투여했다. 내일 밤 효과가 나타난다.");
  }

  if (works(attack)) strike(attack.target);

  for (const s of servicesOf("contract")) {
    strike(s.target);
    tell(s.actor, "청부업자가 " + s.shown.name + "에 대한 일을 처리했다.");
  }

  // ----- 3. 피하 장갑: 오늘 받은 피해 1 무효 -----
  for (const id in dmg) {
    const t = find(id);
    if (dmg[id] > 0 && hasFx(game, t, "armor")) {
      dmg[id]--;
      tell(t, "피하 장갑이 공격 1회를 막아냈다.");
    }
  }

  // ----- 4. 치료 -----
  const doc = actOf("ripperdoc");
  if (works(doc)) {
    const t = doc.target;
    const healed = { type: "healed", name: t.name, text: DEEPFAKE_TEMPLATES.healed(t.name) };
    if (dmg[t.id] > 0) {
      dmg[t.id]--; // 오늘 밤 받은 피해를 막음
      events.push(healed);
    } else if (isInjured(t)) {
      t.hp++; // 예전 부상 회복
      events.push(healed);
    } else {
      tell(doc.actor, doc.shown.name + "은(는) 다친 곳이 없었다.");
    }
  }

  // 의료 드론: 본인만, 발표 없이 조용히
  for (const s of servicesOf("drone")) {
    const t = s.actor;
    if (dmg[t.id] > 0) {
      dmg[t.id]--;
      tell(t, "의료 드론이 오늘 밤 입은 상처를 치료했다.");
    } else if (isInjured(t)) {
      t.hp++;
      tell(t, "의료 드론이 부상을 치료했다.");
    } else {
      tell(t, "의료 드론이 왔지만 치료할 곳이 없었다.");
    }
  }

  // 피해 적용
  for (const id in dmg) {
    if (dmg[id] <= 0) continue;
    const t = find(id);
    t.hp -= dmg[id];
    if (t.hp <= 0) {
      t.hp = 0;
      t.alive = false;
      events.unshift({ type: "dead", name: t.name, text: t.name + "가 사망했다!" });
    } else {
      events.unshift({ type: "injured", name: t.name, text: DEEPFAKE_TEMPLATES.injured(t.name) });
    }
  }

  // ----- 5. 조사 -----
  // 결과 문구에는 행동한 사람이 고른 이름(shown)을 씀. 프록시에 걸렸다면 다른 사람의 정보가 그 이름으로 나옴
  const cop = actOf("cyberpol");
  if (works(cop)) {
    tell(cop.actor, cop.shown.name + " 조사 결과: " + investigate(game, cop.target, rand) + " (둘 중 하나가 진짜)");
  }

  const scan = acts.find((a) => a.actor.role === "netrunner" && a.mode === "scan");
  if (works(scan)) tell(scan.actor, scan.shown.name + "의 직업: " + appearance(game, scan.target));
  if (nr && works(nr)) tell(nr.actor, nr.shown.name + "의 능력을 방해했다.");
  if (wh && works(wh)) tell(wh.actor, wh.shown.name + "의 능력을 방해했다.");

  const watch = actOf("watcher");
  if (works(watch)) {
    const names = [...(targetedBy[watch.target.id] || [])].filter((n) => n !== watch.actor.name);
    tell(watch.actor, names.length
      ? "감시 결과: 오늘 밤 " + watch.shown.name + "에게 능력을 쓴 사람은 " + names.join(", ") + "."
      : "감시 결과: 오늘 밤 " + watch.shown.name + "에게는 아무도 능력을 쓰지 않았다.");
  }

  const dealer = actOf("dealer");
  if (works(dealer)) {
    tell(dealer.actor, dealer.shown.name + "의 보유 크레딧: " + dealer.target.credits + "만");
  }

  // 인포브로커 · 행동 추적: 대상이 오늘 밤 직접 고른 사람들
  for (const s of servicesOf("track")) {
    if (firewalled.has(s)) continue;
    const t = s.target;
    const chosen = [];
    const a = night.actions[t.id];
    if (a) {
      chosen.push(find(a.target)?.name);
      if (a.target2) chosen.push(find(a.target2)?.name);
    }
    if (night.attack && night.attack.by === t.id) chosen.push(find(night.attack.target)?.name);
    if (night.attackVotes && night.attackVotes[t.id]) chosen.push(find(night.attackVotes[t.id])?.name); // 공격 투표도 "지목"으로 잡힘
    const list = chosen.filter(Boolean);
    tell(s.actor, s.shown.name + "이(가) 오늘 밤 지목한 사람: " + (list.length ? list.join(", ") : "없음"));
  }

  // 인포브로커 · 승객 명부: 밤 결과까지 반영한 생존 신디케이트 수
  for (const s of servicesOf("census")) {
    const count = game.players.filter((p) => p.alive && p.team === "syndicate").length;
    tell(s.actor, "승객 명부: 생존한 신디케이트 " + count + "명");
  }

  // 생체 스캐너: 정확한 체력 (디코이는 일반 체력처럼 보이게)
  for (const s of servicesOf("scanner")) {
    const t = s.target;
    const shownMax = hasFx(game, t, "decoy") ? 2 : maxHp(t);
    const shownHp = Math.min(t.hp, shownMax);
    tell(s.actor, s.shown.name + "의 체력: " + shownHp + " / " + shownMax);
  }

  // 송금 로그: 오늘 밤 오간 모든 송금
  for (const s of servicesOf("translog")) {
    const rows = (night.transfers || [])
      .map((tr) => find(tr.from).name + " → " + find(tr.to).name + " " + tr.amount + "만");
    tell(s.actor, "송금 로그: " + (rows.length ? rows.join(", ") : "기록 없음"));
  }

  // ----- 다음 날에 영향을 주는 것들 -----
  const fixer = actOf("fixer");
  game.fixedVoter = null;
  if (works(fixer)) {
    game.fixedVoter = fixer.target.id;
    tell(fixer.actor, fixer.shown.name + "을(를) 매수했다. 오늘 그의 표는 무효가 된다.");
  }

  game.poisoned = newPoison;

  // ----- 딥페이크 속보: 진짜 발표 사이에 섞어 넣기 -----
  // 애니메이션도 진짜와 똑같이 재생되도록 같은 모양의 사건으로 넣음
  const fake = night.deepfake && find(night.deepfake.target);
  if (fake && fake.alive) {
    const text = DEEPFAKE_TEMPLATES[night.deepfake.kind](fake.name);
    if (!events.some((e) => e.text === text)) {
      events.splice(Math.floor(rand() * (events.length + 1)), 0, { type: night.deepfake.kind, name: fake.name, text });
    }
  }

  const lines = events.map((e) => e.text);
  if (lines.length === 0) lines.push("어젯밤은 조용히 지나갔다.");
  return { lines, events, priv };
}

module.exports = { BODYGUARD_REWARD, ACTIONS, SYNDICATE_SPECIALS, maxHp, isInjured, nightOptions, resolveNight, appearance, investigate };
