// =====================================================
//  위스퍼 프로토콜 - 서버
//  하루 흐름 (v2): 1일차 낮 → 밤 → 아침(CCTV) → 낮 → 투표(2일차부터) → 결과
//            → 승리 판정 → 다음 밤 … → 착륙일 투표가 끝나면 착륙
//  낮: 카지노 + 그룹 채팅 + 송금 / 밤: 능력 + 1:1 메신저 + 암상인·다크넷 + 송금
// =====================================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ROLES, TEAM_NAMES, OPTIONS, defaultSettings, teamPlan, rolePool, generateRoles, autoLandingDays } = require("./roles");
const { maxHp, nightOptions, resolveNight } = require("./night");
const {
  ITEMS, DEEPFAKE_TEMPLATES, SERVICES, GAMBLES,
  SHOP_SIZE_MIN, SHOP_SIZE_MAX, MINER_INCOME, MINER_TURNS,
} = require("./economy");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public 폴더 안의 html, css, js를 브라우저에 보내줌
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;
// 최소 인원: 직접 정하면 그 값, Render(온라인)에서는 4명, 내 컴퓨터에서는 테스트하기 쉽게 2명
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS) || (process.env.RENDER ? 4 : 2);
const FAST = Number(process.env.FAST_SECONDS) || 0; // 값이 있으면 모든 단계를 이 시간(초)으로 (빠른 테스트용)

const INTRO_SECONDS = 9; // 시작 연출 (이륙 → 직업 공개)
const MORNING_SECONDS = 10; // 아침 최소 시간. 사건이 많으면 자동으로 늘어남
const SECONDS_PER_EVENT = 3.2; // 사건 하나당 지도 애니메이션 + 자막 시간
const SECONDS_PER_EXECUTION = 8.5; // 처형 연출 (판결 → 에어락 카운트다운 → 추방 → 정적)
const BASE_INCOME = 10; // 매 턴 기본 수입 (만 크레딧)
const VIP_INCOME = 30;
const DEV_START_CREDITS = Number(process.env.START_CREDITS) || 0; // 값이 있으면 방 설정보다 우선 (테스트용)
const VOTE_SECONDS = 25;
const VOTE_EARLY_SECONDS = 2; // 전원이 투표하면 이 시간 뒤 바로 마감
const RESULT_SECONDS = 6;

// 캐릭터 꾸미기: 부위별 선택지 개수 (public/avatar.js 의 AVATAR_PARTS 와 같아야 함)
const AVATAR_LIMITS = { body: 12, top: 12, topColor: 4, eyes: 12, mouth: 10, deco: 8, neck: 6 };

// 브라우저가 보낸 캐릭터 정보에서 허용 범위 안의 정수만 남김
function cleanAvatar(a) {
  const out = {};
  for (const key in AVATAR_LIMITS) {
    const n = a && typeof a === "object" ? Number(a[key]) : 0;
    out[key] = Number.isInteger(n) && n >= 0 && n < AVATAR_LIMITS[key] ? n : 0;
  }
  return out;
}

// 모든 게임방을 담는 객체 { 방코드: 게임방 정보 }
const games = {};

// ----- 도우미 함수들 -----

// 배열 섞기 (피셔-예이츠 셔플)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 표에 "진짜로 있는" 항목만 꺼냄.
// 그냥 TABLE[key]로 꺼내면 "__proto__", "constructor" 같은 이름이 들어왔을 때
// 자바스크립트 기본 속성이 튀어나와 서버가 멈출 수 있음 (QA에서 발견)
function own(table, key) {
  return typeof key === "string" && Object.hasOwn(table, key) ? table[key] : undefined;
}

function findPlayer(game, id) {
  return game.players.find((p) => p.id === id);
}

// 살아있고 접속 중인 사람만
function alivePlayers(game) {
  return game.players.filter((p) => p.alive);
}

// 단계 시간 (FAST가 켜져 있으면 전부 짧게)
function sec(seconds) {
  return FAST || seconds;
}

// 다음 단계 예약 (이전 예약은 취소)
function schedule(game, seconds, next) {
  clearTimeout(game.timer);
  game.timer = setTimeout(() => {
    try {
      next();
    } catch (err) {
      console.error("[오류] 방 " + game.code + " 단계 진행 중:", err);
    }
  }, seconds * 1000);
}

// ----- 설정 검사 -----
// 지금 인원과 직업 구성으로 게임을 시작할 수 있는지 확인
function checkSettings(game) {
  const count = game.players.length;
  const bans = game.settings.bans;
  const errors = [];
  if (count < MIN_PLAYERS) errors.push("최소 " + MIN_PLAYERS + "명이 필요합니다.");

  const plan = teamPlan(Math.max(count, 1));
  const landingDays = game.settings.landingDays === "auto" ? autoLandingDays(count) : game.settings.landingDays;
  // 나올 수 있는 직업 (금지 + 인원 제한 반영)
  const pool = rolePool(bans, count);
  return { errors, landingDays, pool, plan };
}

// 로비 채팅창에 시스템 알림 (입장·퇴장·방장 변경)
function lobbyLog(game, text) {
  io.to("game:" + game.code).emit("lobbyChat", { system: true, text });
}

// 같은 방의 모두에게 로비 정보 전송
function sendLobby(game) {
  io.to("game:" + game.code).emit("lobby", {
    code: game.code,
    hostId: game.hostId,
    hostName: findPlayer(game, game.hostId)?.name,
    phase: game.phase,
    players: game.players.map((p) => ({ name: p.name, color: p.color, avatar: p.avatar })),
    maxPlayers: MAX_PLAYERS,
    settings: game.settings,
    check: checkSettings(game),
    catalog: { roles: ROLES, teams: TEAM_NAMES, options: OPTIONS },
  });
}

// 생존 현황판 (누가 살아있는지는 모두가 알 수 있음)
function sendBoard(game) {
  io.to("game:" + game.code).emit("board", game.players.map((p) => ({ name: p.name, alive: p.alive, color: p.color, avatar: p.avatar })));
}

// 단계 알림: 공통 정보(base)에 각자 다른 정보(personal)를 붙여서 한 명씩 보냄
function sendPhase(game, base, personal) {
  game.phase = base.phase;
  for (const p of game.players) {
    if (!p.connected) continue;
    const extra = personal ? personal(p) : {};
    io.to(p.id).emit("phase", {
      day: game.day,
      landingDays: game.landingDays,
      isHost: p.id === game.hostId,
      alive: p.alive,
      canChat: false,
      ...base,
      ...extra,
    });
  }
}

// 신디케이트 채널에 보여줄 공격 투표 현황 " (현재: 레이븐 2표, 코브라 1표)"
function attackTally(game) {
  const count = {};
  for (const id in game.night.attackVotes) {
    const t = findPlayer(game, game.night.attackVotes[id]);
    if (t) count[t.name] = (count[t.name] || 0) + 1;
  }
  const parts = Object.entries(count).map(([n, c]) => n + " " + c + "표");
  if (!parts.length) return " (공격 투표 없음)";
  return " (현재: " + parts.join(", ") + (parts.length > 1 ? " · 갈리면 50%" : "") + ")";
}

// ----- 직업 배분 -----
// 인원수에 맞춰 랜덤으로 뽑은 직업을 섞어서 한 명씩 나눠줌
function assignRoles(game) {
  const count = game.players.length;
  const deck = shuffle(generateRoles(count, game.settings.bans));
  game.pool = rolePool(game.settings.bans, count); // 이번 판에 "나올 수 있는" 직업 (모두에게 공개)

  game.players.forEach((p, i) => {
    p.role = deck[i];
    p.team = ROLES[deck[i]].team;
    p.alive = true;
    p.hp = maxHp(p);
    p.credits = DEV_START_CREDITS || game.settings.startCredits; // 방장이 정한 시작 자금
    p.credits += ROLES[p.role].startBonus || 0; // 스폰서 추가 자금
    p.cooldowns = {}; // 다크넷 서비스 그룹별 "다시 쓸 수 있는 날"
    p.miner = 0; // 크립토 채굴기 남은 턴
  });
  game.deepfakeUsed = false;
  game.today = emptyDayEffects();

  // 도플갱어: 조사에 보일 가짜 시민팀 직업을 게임 시작 때 하나 정해둠 (나올 수 있는 직업 중에서)
  const fakeRoles = game.pool.filter((id) => ROLES[id].team === "citizen" && id !== "vip");
  game.disguise = {};
  for (const p of game.players) {
    if (p.role === "doppelganger") game.disguise[p.id] = fakeRoles[Math.floor(Math.random() * fakeRoles.length)];
  }

  // 현상금 사냥꾼: 자기 말고 랜덤 1명이 타깃
  for (const p of game.players) {
    if (p.role !== "bounty") continue;
    const others = game.players.filter((t) => t !== p);
    p.bountyTarget = others[Math.floor(Math.random() * others.length)].id;
  }

  // 각자에게 "자기 직업만" 따로 보냄. 신디케이트는 동료 이름도 받음
  const syndicate = game.players.filter((p) => p.team === "syndicate");
  for (const p of game.players) {
    const role = ROLES[p.role];
    if (p.team === "syndicate") io.sockets.sockets.get(p.id)?.join("syn:" + game.code); // 신디케이트 암호화 채널
    io.to(p.id).emit("yourRole", {
      id: p.role,
      name: role.name,
      team: TEAM_NAMES[role.team],
      teamId: role.team,
      desc: role.desc,
      allies: p.team === "syndicate" ? syndicate.filter((s) => s !== p).map((s) => s.name) : [],
      extra: p.bountyTarget ? "타깃: " + findPlayer(game, p.bountyTarget).name : "",
      pool: poolByTeam(game.pool),
    });
  }
}

// 나올 수 있는 직업을 팀별 이름 목록으로 { 시민팀: [...], ... }
function poolByTeam(pool) {
  const out = {};
  for (const id of pool) {
    const r = ROLES[id];
    (out[r.team] = out[r.team] || []).push(r.name);
  }
  return out;
}

// 내 체력과 크레딧 (본인만 봄. 남의 체력은 발표로만 알 수 있음)
function sendStatus(game) {
  for (const p of game.players) {
    io.to(p.id).emit("status", { hp: p.hp, maxHp: maxHp(p), credits: p.credits, alive: p.alive });
  }
}

// =====================================================
//  경제: 암상인 상점, 다크넷, 송금, 도박 (전부 밤에만)
// =====================================================

// 낮에 적용되는 아이템 효과 묶음
function emptyDayEffects() {
  return { wiretaps: {}, masks: new Set(), jams: new Set(), bribes: new Set() };
}

// 독대(밀담 부스) 전용이던 아이템: v2에서 독대가 없어져 진열하지 않음 (2단계 경매에서 새 아이템으로 교체)
const BOOTH_ITEMS = ["wiretap", "mask", "jammer"];

// 오늘 밤 진열할 아이템 5~6개 (딥페이크는 게임당 1회라 이미 쓰였으면 제외)
function rollShop(game) {
  // 테스트용: SHOP_ITEMS=proxy,jammer 처럼 지정하면 그 아이템만 진열
  if (process.env.SHOP_ITEMS) return process.env.SHOP_ITEMS.split(",").filter((id) => ITEMS[id]);
  const pool = Object.keys(ITEMS).filter((id) => !(id === "deepfake" && game.deepfakeUsed) && !BOOTH_ITEMS.includes(id));
  const size = SHOP_SIZE_MIN + Math.floor(Math.random() * (SHOP_SIZE_MAX - SHOP_SIZE_MIN + 1));
  return shuffle(pool).slice(0, size);
}

// 한 사람에게 지금 쓸 수 있는 경제 정보 전송
function sendEconomy(game, p) {
  if (!p.connected) return;
  const shop = game.night?.shop || { open: false, items: [], sold: {} }; // 1일차 낮엔 아직 밤이 없었음
  io.to(p.id).emit("economy", {
    credits: p.credits,
    players: alivePlayers(game).filter((t) => t !== p).map((t) => t.name),
    everyone: alivePlayers(game).map((t) => t.name),
    shop: {
      open: shop.open,
      items: shop.items.map((id) => ({ id, ...ITEMS[id], sold: !!shop.sold[id] })),
    },
    services: Object.keys(SERVICES).map((id) => {
      const s = SERVICES[id];
      const readyDay = Math.max(p.cooldowns[s.group] || 0, s.minDay || 0); // 쿨다운, 사용 가능 시작일 중 늦은 쪽
      return { id, ...s, waitDays: Math.max(0, readyDay - game.day) };
    }),
    gambles: Object.keys(GAMBLES).map((id) => ({
      id,
      ...GAMBLES[id],
      chance: GAMBLES[id].chance,
    })),
    deepfakeTemplates: { injured: "OOO가 부상을 입었다!", healed: "리퍼닥이 OOO을(를) 치료했다!" },
    mine: { done: mineState(game, p).done, total: MINE_REWARDS.length, next: MINE_REWARDS[mineState(game, p).done] || 0 },
  });
}

function sendEconomyAll(game) {
  for (const p of alivePlayers(game)) sendEconomy(game, p);
}

// 나만 보는 경제 알림 (채팅 로그에 표시)
function econMsg(p, text) {
  io.to(p.id).emit("econMsg", text);
}

// 밤에 살아있는 사람만 경제 행동 가능. 통과하면 { game, me }
function nightPlayer(socket) {
  const game = games[socket.data.code];
  if (!game || game.phase !== "night") return null;
  const me = findPlayer(game, socket.id);
  if (!me || !me.alive) return null;
  return { game, me };
}

// 카지노(도박·채굴): 낮에만
function casinoPlayer(socket) {
  const game = games[socket.data.code];
  if (!game || game.phase !== "day") return null;
  const me = findPlayer(game, socket.id);
  if (!me || !me.alive) return null;
  return { game, me };
}

// 송금: 낮과 밤 모두 가능
function moneyPlayer(socket) {
  const game = games[socket.data.code];
  if (!game || (game.phase !== "day" && game.phase !== "night")) return null;
  const me = findPlayer(game, socket.id);
  if (!me || !me.alive) return null;
  return { game, me };
}

// 1 이상, 가진 돈 이하의 정수만 허용
function validAmount(value, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

function openShop(game) {
  if (game.phase !== "night" || game.night.shop.open) return;
  game.night.shop.open = true;
  for (const p of alivePlayers(game)) econMsg(p, "화물칸 해치가 열렸다. 암상인 \"고스트\"가 도착했다.");
  sendEconomyAll(game);
}

// 구매: 먼저 누른 사람이 바로 가져감 (선착순)
// 서버는 요청을 한 번에 하나씩 처리하므로, 거의 동시에 눌러도 먼저 도착한 요청이 이김
function requestBuy(game, me, data) {
  const shop = game.night.shop;
  const id = data?.item;
  const item = own(ITEMS, id);
  if (!shop.open) return econMsg(me, "암상인이 아직 도착하지 않았다.");
  if (!item || !shop.items.includes(id)) return;
  if (shop.sold[id]) return econMsg(me, "다른 손님이 " + item.name + "을(를) 먼저 가져갔다.");
  if (me.credits < item.price) return econMsg(me, "크레딧이 부족하다.");

  // 대상 확인
  const payload = {};
  if (item.target === "player" || item.target === "deepfake") {
    const t = game.players.find((p) => p.name === data.target && p.alive);
    if (!t) return;
    if (item.target === "player" && t === me) return econMsg(me, "자기 자신은 고를 수 없다.");
    payload.target = t.id;
  }
  if (item.target === "deepfake") {
    if (!own(DEEPFAKE_TEMPLATES, data.kind)) return;
    payload.kind = data.kind;
  }

  me.credits -= item.price;
  shop.sold[id] = true;
  applyItem(game, me, id, payload);

  econMsg(me, item.name + " 구매 완료! (-" + item.price + "만)");
  sendStatus(game);
  sendEconomyAll(game); // 모두에게 솔드아웃 표시 (구매자 이름은 비공개)
}

// 아이템 효과 등록
function applyItem(game, p, id, payload) {
  const night = game.night;
  const tomorrow = game.tomorrow;
  if (["proxy", "firewall", "armor", "decoy", "launder"].includes(id)) {
    (night.effects[p.id] = night.effects[p.id] || new Set()).add(id);
  } else if (id === "scanner") night.services.push({ type: "scanner", by: p.id, target: payload.target });
  else if (id === "translog") night.services.push({ type: "translog", by: p.id });
  else if (id === "wiretap") tomorrow.wiretaps[p.id] = payload.target;
  else if (id === "mask") tomorrow.masks.add(p.id);
  else if (id === "jammer") tomorrow.jams.add(payload.target);
  else if (id === "bribe") tomorrow.bribes.add(p.id);
  else if (id === "miner") p.miner += MINER_TURNS;
  else if (id === "deepfake") {
    night.deepfake = { kind: payload.kind, target: payload.target };
    game.deepfakeUsed = true;
  }
}

// 밤이 끝날 때: 상점 도착 타이머 정리하고 닫기
function closeShop(game) {
  const shop = game.night.shop;
  for (const t of shop.timers) clearTimeout(t);
  shop.timers = [];
  shop.open = false;
}

// 다크넷 서비스
function useService(game, me, data) {
  const id = data?.service;
  const s = own(SERVICES, id);
  if (!s) return;
  if (s.minDay && game.day < s.minDay) return econMsg(me, s.name + ": " + s.minDay + "일차 밤부터 쓸 수 있다.");
  if ((me.cooldowns[s.group] || 0) > game.day) return econMsg(me, s.name + ": 아직 쿨다운 중이다.");
  if (me.credits < s.price) return econMsg(me, "크레딧이 부족하다.");

  let target = null;
  if (s.target) {
    target = game.players.find((p) => p.name === data.target && p.alive);
    if (!target || target === me) return;
  }

  me.credits -= s.price;
  me.cooldowns[s.group] = game.day + s.cooldown;
  game.night.services.push({ type: id, by: me.id, target: target ? target.id : null });
  econMsg(me, s.name + " 의뢰 완료 (-" + s.price + "만)" + (target ? " → " + target.name : "") + ". 결과는 아침에.");
  sendStatus(game);
  sendEconomy(game, me);
}

// 송금: 바로 전달되고, 받는 사람은 보낸 사람을 알게 됨
function transfer(game, me, data) {
  const target = game.players.find((p) => p.name === data?.target && p.alive);
  const amount = validAmount(data?.amount, me.credits);
  if (!target || target === me) return;
  if (!amount) return econMsg(me, "송금액을 확인하세요. (1 ~ " + me.credits + "만)");

  me.credits -= amount;
  target.credits += amount;
  if (game.phase === "night") game.night.transfers.push({ from: me.id, to: target.id, amount }); // 송금 로그는 밤 송금만
  econMsg(me, target.name + "에게 " + amount + "만 크레딧을 보냈다.");
  econMsg(target, me.name + "에게서 " + amount + "만 크레딧을 받았다.");
  sendStatus(game);
  sendEconomy(game, me);
  sendEconomy(game, target);
}

// 도박: 바로 결과가 나옴
function gamble(game, me, data) {
  const g = own(GAMBLES, data?.kind);
  if (!g) return;
  const amount = validAmount(data.amount, me.credits);
  if (!amount) {
    return io.to(me.id).emit("gambleResult", { kind: data.kind, error: "베팅액을 확인하세요. (1 ~ " + me.credits + "만)" });
  }

  const win = Math.random() < g.chance;
  const delta = win ? amount * (g.payout - 1) : -amount;
  me.credits += delta;

  // 결과는 화면이 룰렛/슬롯 애니메이션을 끝낸 뒤에 보여줌
  io.to(me.id).emit("gambleResult", { kind: data.kind, name: g.name, win, delta, credits: me.credits });
  sendStatus(game);
  sendEconomy(game, me);
}

// =====================================================
//  채굴 미션 (카지노)
//  서버가 문제를 내고 정답을 채점 → 화면을 조작해도 크레딧을 거저 얻을 수 없음
//  낮마다 미션 5개. 갈수록 어렵고 보상도 커짐
// =====================================================
const MINE_REWARDS = [2, 2, 3, 3, 5]; // 미션별 보상 (만)
const MINE_SECONDS = 10; // 문제 하나 제한 시간
const MINE_LOCK_MS = 5000; // 틀리거나 시간 초과면 5초 쉬기
// 미션 순서: 해시 찾기 / 블록 순서 맞추기를 번갈아, 점점 어렵게
const MINE_PLAN = [
  { type: "hash", cells: 9, prefix: 3, share: 1 },
  { type: "order", count: 5 },
  { type: "hash", cells: 12, prefix: 3, share: 2 },
  { type: "order", count: 7 },
  { type: "hash", cells: 16, prefix: 4, share: 3 },
];
const HEX = "0123456789ABCDEF";
const randHex = (n) => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join("");

// 오늘 낮의 내 채굴 기록. 날이 바뀌면 새로 시작
function mineState(game, p) {
  const key = String(game.day);
  if (!p.mine || p.mine.key !== key) p.mine = { key, done: 0, challenge: null, lockUntil: 0 };
  return p.mine;
}

function mineStart(game, me) {
  const m = mineState(game, me);
  if (m.done >= MINE_REWARDS.length) return io.to(me.id).emit("mineResult", { error: "오늘의 채굴 미션을 모두 끝냈다." });
  const wait = m.lockUntil - Date.now();
  if (wait > 0) return io.to(me.id).emit("mineResult", { error: "과열! " + Math.ceil(wait / 1000) + "초 뒤에 다시 시도" });

  const plan = MINE_PLAN[m.done];
  const pub = { mission: m.done + 1, total: MINE_REWARDS.length, reward: MINE_REWARDS[m.done], seconds: MINE_SECONDS, type: plan.type };
  let answer;
  if (plan.type === "hash") {
    // 정답 1개: target으로 시작 / 나머지: 앞 share글자까지만 같고 그 다음 글자가 다름 (헷갈리게)
    const target = randHex(plan.prefix);
    const cells = new Set();
    const decoys = [];
    while (decoys.length < plan.cells - 1) {
      const head = target.slice(0, plan.share);
      let next = HEX[Math.floor(Math.random() * 16)];
      if (next === target[plan.share]) continue;
      const code = head + next + randHex(6 - plan.share - 1);
      if (cells.has(code)) continue;
      cells.add(code);
      decoys.push(code);
    }
    const right = target + randHex(6 - plan.prefix);
    const list = shuffle([right, ...decoys]);
    answer = list.indexOf(right);
    Object.assign(pub, { target, cells: list });
  } else {
    // 블록 순서: 흩어진 숫자 1~N을 작은 수부터 차례로
    const nums = shuffle(Array.from({ length: plan.count }, (_, i) => i + 1));
    answer = nums.map((_, i) => i).sort((a, b) => nums[a] - nums[b]).join(",");
    Object.assign(pub, { cells: nums });
  }
  m.challenge = { answer, expires: Date.now() + (MINE_SECONDS + 1) * 1000 }; // 1초는 통신 여유
  io.to(me.id).emit("mineChallenge", pub);
}

function mineAnswer(game, me, data) {
  const m = mineState(game, me);
  const c = m.challenge;
  if (!c) return io.to(me.id).emit("mineResult", { error: "문제가 만료되었다. 다시 시작하자." });
  m.challenge = null;
  const given = Array.isArray(data?.answer) ? data.answer.map(Number).join(",") : Number(data?.answer);
  const ok = Date.now() <= c.expires && given === c.answer;
  if (!ok) {
    m.lockUntil = Date.now() + MINE_LOCK_MS;
    io.to(me.id).emit("mineResult", { ok: false, timeout: Date.now() > c.expires, lock: MINE_LOCK_MS / 1000 });
    return;
  }
  const reward = MINE_REWARDS[m.done];
  m.done++;
  me.credits += reward;
  io.to(me.id).emit("mineResult", { ok: true, delta: reward, done: m.done, total: MINE_REWARDS.length });
  sendStatus(game);
  sendEconomy(game, me);
}

// =====================================================
//  하루 흐름 (단계 머신)
// =====================================================

function startGame(game) {
  game.day = 0;
  game.landingDays = checkSettings(game).landingDays;
  assignRoles(game);
  sendBoard(game);

  // 시작 연출: 이륙 → 직업 카드 공개. 끝나면 1일차 낮
  const seconds = sec(INTRO_SECONDS);
  sendPhase(game, { phase: "intro", title: "탑승", seconds, shipName: "레비아탄" });
  schedule(game, seconds, () => {
    game.day = 1;
    startDay(game);
  });
}

// 방송으로 보여줄 시간: 줄 수에 맞춰 늘어남
function sequenceSeconds(sequence, min) {
  const total = sequence.reduce((t, item) => t + (item.type === "executed" ? SECONDS_PER_EXECUTION : SECONDS_PER_EVENT), 0);
  return sec(Math.max(min, Math.ceil(3.5 + total))); // 3.5초: 단계 타이틀 카드 + 여유
}

// ----- 3. 밤 -----
// 직업 능력, 1:1 메신저, 암상인 상점, 다크넷, 송금
function startNight(game) {
  game.night = {
    actions: {},
    attackVotes: {}, // 신디케이트 공격 투표 { 투표한 사람 id: 대상 id }
    effects: {}, // 오늘 밤 아이템 효과 { id: Set }
    services: [], // 다크넷 서비스, 아침에 결과가 나오는 아이템
    transfers: [],
    deepfake: null,
    dms: [], // 1:1 메신저 기록 { from, to, text } (사망자 관전용)
    shop: { items: rollShop(game), sold: {}, open: false, timers: [] },
  };
  game.tomorrow = emptyDayEffects(); // 오늘 밤에 산 "내일 효과" 아이템

  const seconds = sec(game.settings.nightSeconds);

  // 암상인은 밤 시간의 15%~50% 사이 랜덤한 때 도착
  const arrive = seconds * (0.15 + Math.random() * 0.35);
  game.night.shop.timers.push(setTimeout(() => openShop(game), arrive * 1000));
  for (const p of alivePlayers(game)) sendEconomy(game, p);

  const contacts = alivePlayers(game).map((p) => p.name);
  sendPhase(game, { phase: "night", title: "밤 · 통행금지", seconds }, (p) => {
    if (!p.alive) return { info: "관전 중. 메신저에서 모든 1:1 대화를 볼 수 있습니다.", dm: { spectate: true } };
    const info = p.team === "syndicate"
      ? "암호화 채널이 열렸습니다. 공격 투표로 대상을 정하세요. 1:1 대화는 메신저 앱에서."
      : "통행금지 시간. 능력을 쓰고, 메신저 앱으로 1:1 대화를 나누세요.";
    return {
      canChat: p.team === "syndicate", // 아래 입력창 = 신디케이트 채널. 1:1 대화는 메신저 앱 안에서
      info,
      action: nightOptions(game, p),
      dm: { contacts: contacts.filter((n) => n !== p.name) },
    };
  });

  schedule(game, seconds, () => startMorning(game));
}

// ----- 4. 아침 발표 (CCTV) -----
function startMorning(game) {
  game.day++; // 아침이 오면 새 날
  closeShop(game); // 결정 못 한 구매 요청을 마저 처리하고 상점 닫기
  game.today = game.tomorrow; // 어젯밤 산 "내일 효과"가 오늘 적용됨

  const night = resolveNight(game);
  sendBoard(game);
  sendStatus(game);

  // 선내 방송 순서: { text } 는 글자만, { type, name } 이 있으면 복도에서 애니메이션도 재생
  const left = game.landingDays - game.day;
  const sequence = [];
  if (night.events.length) sequence.push(...night.events);
  else sequence.push({ text: night.lines[0] });
  sequence.push({ text: left === 0 ? "오늘 밤, 비행선이 착륙한다." : "착륙까지 " + left + "일 남았다." });
  const lines = sequence.map((s) => s.text);

  const seconds = sequenceSeconds(sequence, MORNING_SECONDS);
  sendPhase(game, { phase: "morning", title: "아침 발표", seconds, lines, sequence }, (p) => ({
    private: night.priv[p.id] || [], // 나만 보는 밤 결과
  }));

  // 밤 사이 승부가 났어도(예: VIP 사망) 아침 방송과 복도 연출을 끝까지 보여준 뒤 종료
  schedule(game, seconds, () => {
    if (!endIfWinner(game)) startDay(game);
  });
}

// ----- 1. 낮 -----
// 카지노 + 그룹 채팅 + 송금. 매일 낮이 시작될 때 수입이 들어옴
function startDay(game) {
  for (const p of alivePlayers(game)) {
    p.credits += p.role === "vip" ? VIP_INCOME : BASE_INCOME;
    if (p.miner > 0) {
      p.credits += MINER_INCOME;
      p.miner--;
    }
  }
  sendStatus(game);

  const seconds = sec(game.settings.daySeconds);
  const voteToday = game.day >= 2;
  sendPhase(game, { phase: "day", title: "낮 · 카지노 라운지", seconds, voteToday }, (p) => {
    if (!p.alive) return { info: "관전 중. 그룹 채팅을 볼 수 있습니다." };
    const first = game.day === 1 ? "카지노 비행선이 이륙했다. 오늘은 투표가 없습니다. " : "";
    return {
      canChat: true,
      canCasino: true,
      info: first + "그룹 채팅으로 이야기하고, 카지노에서 크레딧을 벌어 두세요." + (voteToday ? " 낮이 끝나면 투표." : ""),
    };
  });
  sendEconomyAll(game); // 채굴 남은 횟수 등 오늘 기준으로

  schedule(game, seconds, () => {
    if (voteToday) startVote(game);
    else endDay(game);
  });
}

// ----- 2. 투표 (2일차부터) -----
function startVote(game) {
  game.votes = {}; // { 투표한 사람 id: 찍은 사람 id }
  game.voteClosing = false;
  const seconds = sec(VOTE_SECONDS);
  const candidates = alivePlayers(game).map((p) => p.name);

  sendPhase(game, { phase: "vote", title: "투표", seconds }, (p) => {
    if (!p.alive) return { info: "사망자는 투표할 수 없습니다." };
    return {
      canVote: true,
      candidates: candidates.filter((n) => n !== p.name),
      info: "비행선 밖으로 던질 사람을 고르세요. 최다 득표자는 즉시 사망합니다.",
    };
  });

  schedule(game, seconds, () => resolveVote(game));
}

// 살아있는 사람이 모두 투표했으면 곧바로 마감
function checkAllVoted(game) {
  if (game.phase !== "vote" || game.voteClosing) return;
  const alive = alivePlayers(game);
  if (alive.length && alive.every((p) => game.votes[p.id])) {
    game.voteClosing = true;
    io.to("game:" + game.code).emit("voteClosing", VOTE_EARLY_SECONDS);
    schedule(game, VOTE_EARLY_SECONDS, () => resolveVote(game));
  }
}

function resolveVote(game) {
  // 득표 세기. 신디케이트 표도 똑같이 들어감
  const tally = {};
  for (const voterId in game.votes) {
    const voter = findPlayer(game, voterId);
    const target = findPlayer(game, game.votes[voterId]);
    if (!voter || !voter.alive || !target || !target.alive) continue;
    if (voter.id === game.fixedVoter) continue; // 픽서에게 매수당한 표는 몰래 빠짐
    const weight = game.today.bribes.has(voter.id) ? 2 : 1; // 뇌물을 산 사람은 2표
    tally[target.id] = (tally[target.id] || 0) + weight;
  }

  // 득표 수는 서버 안에서만 씀. 화면에는 "누가 처형됐는지 / 동점이었는지"만 공개
  const results = alivePlayers(game)
    .map((p) => ({ name: p.name, count: tally[p.id] || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const sequence = [];
  const top = results[0];
  const tie = results[1] && results[1].count === top.count;
  let victim = null;

  if (!top) sequence.push({ text: "아무도 표를 받지 않았다. 처형 없음." });
  else if (tie) sequence.push({ text: "최다 득표가 동점이다. 처형 없음." });
  else {
    victim = game.players.find((p) => p.name === top.name);
    victim.alive = false;
    victim.hp = 0;
    const item = { type: "executed", name: victim.name, text: victim.name + "가 비행선 밖으로 추방되었다!" };
    if (game.settings.revealRole === "show") {
      item.role = ROLES[victim.role].name + " (" + TEAM_NAMES[victim.team] + ")";
      item.roleId = victim.role;
    }
    sequence.push(item);
    sendBoard(game);
    sendStatus(game);
  }
  const lines = sequence.map((s) => (s.role ? s.text + " 직업: " + s.role : s.text));

  const seconds = sequenceSeconds(sequence, RESULT_SECONDS);
  sendPhase(game, { phase: "result", title: "투표 결과", seconds, lines, sequence });

  schedule(game, seconds, () => {
    // 현상금 사냥꾼: 타깃이 투표로 처형되면 단독 승리
    const hunter = victim && alivePlayers(game).find((p) => p.bountyTarget === victim.id);
    if (hunter) return endGame(game, "third", "현상금 사냥꾼 " + hunter.name + "가 " + victim.name + "의 현상금을 챙겼다.", hunter);
    if (!endIfWinner(game)) endDay(game);
  });
}

// ----- 하루 끝: 착륙일이면 착륙, 아니면 다음 밤 -----
function endDay(game) {
  if (game.day >= game.landingDays) return land(game);
  startNight(game);
}

// =====================================================
//  승리 판정
// =====================================================

// 지금 승부가 났는지 확인. 났으면 { winner, reason }
function findWinner(game) {
  const alive = alivePlayers(game);
  const vipAlive = alive.some((p) => p.role === "vip");
  const syndicate = alive.filter((p) => p.team === "syndicate").length;
  const citizens = alive.filter((p) => p.team === "citizen").length;

  if (!vipAlive) return { winner: "syndicate", reason: "VIP가 사망했다." };
  if (syndicate === 0) return { winner: "citizen", reason: "신디케이트를 모두 제거했다." };
  if (citizens === 1) return { winner: "syndicate", reason: "시민팀에 VIP 혼자 남았다." };
  return null;
}

function endIfWinner(game) {
  const result = findWinner(game);
  if (!result) return false;
  endGame(game, result.winner, result.reason);
  return true;
}

// 착륙: 밀항자가 살아있으면 단독 승리, 아니면 VIP를 지켜낸 시민팀 승리
function land(game) {
  const stowaway = alivePlayers(game).find((p) => p.role === "stowaway");
  if (stowaway) endGame(game, "third", "비행선이 착륙했다. 밀항자 " + stowaway.name + "가 몰래 내렸다.", stowaway);
  else endGame(game, "citizen", "비행선이 무사히 착륙했다.");
}

// soloWinner: 제3세력은 팀이 아니라 그 사람 한 명만 이김
function endGame(game, winner, reason, soloWinner) {
  clearTimeout(game.timer);
  if (game.night) for (const t of game.night.shop.timers) clearTimeout(t); // 밤 중에 끝나면 상점 타이머도 정리

  const won = (p) => (soloWinner ? p === soloWinner : p.team === winner);

  // 게임이 끝나면 모든 정체 공개
  const reveal = game.players.map((p) => ({
    name: p.name,
    color: p.color,
    avatar: p.avatar,
    role: ROLES[p.role].name,
    roleId: p.role,
    teamId: p.team,
    alive: p.alive,
    won: won(p),
  }));

  const headline = soloWinner ? ROLES[soloWinner.role].name + " " + soloWinner.name + " 단독 승리!" : TEAM_NAMES[winner] + " 승리!";
  sendPhase(
    game,
    { phase: "over", title: "게임 종료", seconds: 0, winner, headline, reason, lines: [headline, reason], reveal, day: game.day },
    (p) => ({ won: won(p) })
  );
}

// 게임이 끝난 뒤 방장이 로비로 되돌림
function backToLobby(game) {
  clearTimeout(game.timer);
  game.players = game.players.filter((p) => p.connected); // 나간 사람 정리
  for (const p of game.players) {
    io.sockets.sockets.get(p.id)?.leave("syn:" + game.code);
    p.role = null;
    p.team = null;
    p.alive = true;
    p.bountyTarget = null;
    p.credits = 0;
    p.cooldowns = {};
    p.miner = 0;
  }
  game.today = emptyDayEffects();
  game.deepfakeUsed = false;
  game.phase = "lobby";
  game.day = 0;
  game.poisoned = [];
  game.fixedVoter = null;
  game.fixerUsedDay = null;
  if (!findPlayer(game, game.hostId)) game.hostId = game.players[0].id;
  sendLobby(game);
}

// =====================================================
//  접속한 플레이어 한 명마다 실행되는 부분
// =====================================================
io.on("connection", (socket) => {
  // 이벤트 처리 중 오류가 나도 서버 전체가 멈추지 않도록 감싸서 등록
  const on = (event, handler) => {
    socket.on(event, (...args) => {
      try {
        handler(...args);
      } catch (err) {
        console.error("[오류] " + event + " 처리 중:", err);
      }
    });
  };

  // 방장만, 로비에서만 설정을 바꿀 수 있음. 통과하면 그 방을 돌려줌
  function hostLobby() {
    const game = games[socket.data.code];
    if (!game || game.hostId !== socket.id || game.phase !== "lobby") return null;
    return game;
  }

  // 방 입장
  on("join", (data) => {
    if (socket.data.code) return; // 이미 입장한 사람은 무시

    const code = String(data?.code ?? "").trim().toUpperCase().slice(0, 6);
    const name = String(data?.name ?? "").trim().slice(0, 12);
    if (!code || !name) return socket.emit("errorMsg", "방 코드와 닉네임을 입력하세요.");

    let game = games[code];
    if (!game) {
      // 처음 들어온 사람이 방을 만들고 방장이 됨
      game = {
        code,
        hostId: socket.id,
        players: [],
        phase: "lobby",
        day: 0,
        round: 0,
        settings: defaultSettings(),
        timer: null,
      };
      games[code] = game;
    }

    if (game.phase !== "lobby") return socket.emit("errorMsg", "이미 게임이 진행 중인 방입니다.");
    if (game.players.length >= MAX_PLAYERS) return socket.emit("errorMsg", "방이 가득 찼습니다.");
    if (game.players.some((p) => p.name === name)) return socket.emit("errorMsg", "이미 사용 중인 닉네임입니다.");

    // 고유 색 번호: 비어 있는 가장 앞 번호 (0~9). 화면에서 토큰 색으로 씀
    const used = new Set(game.players.map((p) => p.color));
    let color = 0;
    while (used.has(color)) color++;

    game.players.push({ id: socket.id, name, color, avatar: cleanAvatar(data?.avatar), role: null, team: null, alive: true, connected: true });
    socket.data.code = code;
    socket.data.name = name;
    socket.join("game:" + code);
    lobbyLog(game, name + " 님이 탑승했습니다." + (game.hostId === socket.id ? " (방장)" : ""));
    sendLobby(game);
  });

  // 로비 채팅 (로비에 있는 동안만)
  on("lobbyChat", (text) => {
    const game = games[socket.data.code];
    if (!game || game.phase !== "lobby") return;
    const me = findPlayer(game, socket.id);
    const clean = String(text ?? "").trim().slice(0, 200);
    if (!me || !clean) return;
    io.to("game:" + game.code).emit("lobbyChat", { fromId: me.id, from: me.name, text: clean });
  });

  // 방장 넘기기 (방장만, 로비에서만)
  on("transferHost", (name) => {
    const game = hostLobby();
    if (!game) return;
    const to = game.players.find((p) => p.name === name);
    if (!to || to.id === socket.id) return;
    game.hostId = to.id;
    lobbyLog(game, socket.data.name + " 님이 " + to.name + " 님에게 방장을 넘겼습니다.");
    sendLobby(game);
  });

  // 게임 옵션 변경 (착륙일, 시간 등). 허용 목록에 있는 값만 받음
  on("setOption", (data) => {
    const game = hostLobby();
    if (!game) return;

    const option = own(OPTIONS, data?.key);
    if (!option) return;

    const value = option.values.find((v) => String(v) === String(data.value));
    if (value === undefined) return;

    game.settings[data.key] = value;
    sendLobby(game);
  });

  // 직업 금지 / 금지 해제 (VIP, 블레이드, 시민은 금지 불가)
  on("toggleBan", (data) => {
    const game = hostLobby();
    if (!game) return;
    const role = own(ROLES, data?.id);
    if (!role || role.noBan) return;
    const bans = game.settings.bans;
    game.settings.bans = bans.includes(data.id) ? bans.filter((id) => id !== data.id) : [...bans, data.id];
    sendLobby(game);
  });

  // 방장이 시작 버튼을 누름
  on("start", () => {
    const game = hostLobby();
    if (!game) return;

    const { errors } = checkSettings(game);
    if (errors.length > 0) return socket.emit("errorMsg", errors[0]);

    startGame(game);
  });

  // 채팅: 지금 단계와 내 상태를 보고 서버가 보낼 곳을 정함
  on("chat", (text) => {
    const game = games[socket.data.code];
    if (!game) return;

    const me = findPlayer(game, socket.id);
    if (!me || !me.alive) return; // 사망자는 말할 수 없음

    const clean = String(text ?? "").trim().slice(0, 200);
    if (!clean) return;

    const msg = { fromId: socket.id, from: me.name, text: clean };

    if (game.phase === "night" && me.team === "syndicate") {
      io.to("syn:" + game.code).emit("chat", { ...msg, channel: "syndicate" });
    } else if (game.phase === "day") {
      io.to("game:" + game.code).emit("chat", { ...msg, channel: "group" }); // 그룹 채팅 (사망자도 읽기만)
    }
    // 그 외(밤의 일반 승객, 투표 시간 등)는 무시. 밤 1:1 대화는 "dm"으로
  });

  // 밤 1:1 메신저: 보낸 사람과 받는 사람에게만. 사망자는 모든 대화를 관전
  on("dm", (data) => {
    const game = games[socket.data.code];
    if (!game || game.phase !== "night") return;
    const me = findPlayer(game, socket.id);
    const to = game.players.find((p) => p.name === data?.to);
    if (!me || !me.alive || !to || !to.alive || to === me) return;
    const text = String(data?.text ?? "").trim().slice(0, 200);
    if (!text) return;
    const msg = { fromId: me.id, from: me.name, to: to.name, text, channel: "dm" };
    game.night.dms.push({ from: me.name, to: to.name, text });
    io.to(me.id).emit("dm", msg);
    io.to(to.id).emit("dm", msg);
    for (const p of game.players) if (!p.alive && p.connected) io.to(p.id).emit("dm", { ...msg, spectate: true });
  });

  // 밤 행동 선택 (밤이 끝나기 전까지 바꿀 수 있음)
  on("nightAction", (data) => {
    const game = games[socket.data.code];
    if (!game || game.phase !== "night") return;

    const me = findPlayer(game, socket.id);
    if (!me) return;

    // 지금 내가 할 수 있는 행동 목록에 있는 값만 받음
    const opt = nightOptions(game, me);
    if (opt.reason) return;
    if (opt.modes && !own(opt.modes, data?.mode)) return;
    const candidates = opt.modeCandidates ? opt.modeCandidates[data.mode] : opt.candidates;
    if (!candidates.includes(data?.target)) return;
    if (opt.pair && (!candidates.includes(data.target2) || data.target2 === data.target)) return;

    const byName = (name) => game.players.find((p) => p.name === name);
    const target = byName(data.target);
    const night = game.night;
    const synSay = (text) => io.to("syn:" + game.code).emit("chat", { fromId: null, from: "작전", text, channel: "syndicate" });

    if (opt.attackOnly || data.mode === "attack") {
      // 신디케이트 공격 투표 (특수 능력은 취소됨)
      delete night.actions[me.id];
      night.attackVotes[me.id] = target.id;
      synSay(me.name + " → 공격 투표: " + target.name + attackTally(game));
    } else {
      // 직업 능력 (신디케이트라면 공격 투표는 취소됨)
      if (night.attackVotes[me.id]) {
        delete night.attackVotes[me.id];
        synSay(me.name + "이(가) 공격 투표를 거두고 특수 능력을 쓴다." + attackTally(game));
      }
      night.actions[me.id] = {
        target: target.id,
        target2: opt.pair ? byName(data.target2).id : null,
        mode: data.mode || null,
      };
    }

    const what = opt.pair ? target.name + " ↔ " + data.target2 : target.name;
    const label = opt.modes ? opt.modes[data.mode] : opt.label;
    socket.emit("actionSet", label + ": " + what);
  });

  // ----- 경제 (밤에만) -----
  on("buy", (data) => {
    const ctx = nightPlayer(socket);
    if (ctx) requestBuy(ctx.game, ctx.me, data);
  });
  on("darknet", (data) => {
    const ctx = nightPlayer(socket);
    if (ctx) useService(ctx.game, ctx.me, data);
  });
  on("transfer", (data) => {
    const ctx = moneyPlayer(socket);
    if (ctx) transfer(ctx.game, ctx.me, data);
  });
  on("gamble", (data) => {
    const ctx = casinoPlayer(socket);
    if (ctx) gamble(ctx.game, ctx.me, data);
  });
  on("mineStart", () => {
    const ctx = casinoPlayer(socket);
    if (ctx) mineStart(ctx.game, ctx.me);
  });
  on("mineAnswer", (data) => {
    const ctx = casinoPlayer(socket);
    if (ctx) mineAnswer(ctx.game, ctx.me, data);
  });

  // 투표 (마감 전까지 바꿀 수 있음)
  on("vote", (targetName) => {
    const game = games[socket.data.code];
    if (!game || game.phase !== "vote") return;

    const me = findPlayer(game, socket.id);
    const target = game.players.find((p) => p.name === targetName);
    if (!me || !me.alive || !target || !target.alive || target === me) return;

    game.votes[me.id] = target.id;
    socket.emit("voted", target.name);
    checkAllVoted(game);
  });

  on("backToLobby", () => {
    const game = games[socket.data.code];
    if (!game || game.phase !== "over" || game.hostId !== socket.id) return;
    backToLobby(game);
  });

  // 같은 멤버, 같은 설정으로 바로 다시 시작 (인원이 바뀌어 설정이 안 맞으면 로비에 머묾)
  on("restart", () => {
    const game = games[socket.data.code];
    if (!game || game.phase !== "over" || game.hostId !== socket.id) return;
    backToLobby(game);
    const { errors } = checkSettings(game);
    if (errors.length > 0) return socket.emit("errorMsg", "바로 시작할 수 없습니다: " + errors[0]);
    startGame(game);
  });

  // 접속 끊김
  on("disconnect", () => {
    const game = games[socket.data.code];
    if (!game) return;

    const me = findPlayer(game, socket.id);
    if (!me) return;

    if (game.phase === "lobby") {
      game.players = game.players.filter((p) => p !== me);
    } else {
      // 게임 중에 나가면 사망 처리 (정체 공개를 위해 목록에는 남김)
      me.connected = false;
      me.alive = false;
      me.hp = 0;
    }

    const online = game.players.filter((p) => p.connected);
    if (online.length === 0) {
      clearTimeout(game.timer);
      delete games[game.code];
      return;
    }
    const wasHost = game.hostId === socket.id;
    if (wasHost) game.hostId = online[0].id; // 방장 넘기기

    if (game.phase === "lobby") {
      lobbyLog(game, me.name + " 님이 내렸습니다." + (wasHost ? " 새 방장: " + findPlayer(game, game.hostId).name : ""));
      return sendLobby(game);
    }

    sendBoard(game);
    if (game.phase === "over") return;
    if (endIfWinner(game)) return; // 나간 사람이 VIP나 마지막 신디케이트였다면 바로 판정
    checkAllVoted(game); // 투표 중에 나갔으면 남은 사람이 다 찍었는지 다시 확인
  });
});

// 최후의 안전장치: 놓친 오류가 있어도 서버 전체(모든 방)가 꺼지지 않게 기록만 남김
process.on("uncaughtException", (err) => console.error("[치명적 오류]", err));

server.listen(PORT, () => {
  console.log("서버 실행 중: http://localhost:" + PORT);
});
