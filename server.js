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
  ITEMS, DEEPFAKE_TEMPLATES, SERVICES, SERVICE_NIGHT_LIMIT, servicePrice, AUCTION, bidStep,
  MINER_INCOME, MINER_TURNS,
} = require("./economy");
const casino = require("./casino");

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
const SECONDS_PER_EVENT = 6; // 사건 하나당 CCTV 재생 시간 (방문 → 공격 → 방어·회복 → 결과)
const SECONDS_PER_LINE = 2.6; // 글자만 있는 방송 한 줄
const SECONDS_PER_EXECUTION = 8.5; // 처형 연출 (판결 → 에어락 카운트다운 → 추방 → 정적)
const BASE_INCOME = 10; // 매 턴 기본 수입 (만 크레딧)
const VIP_INCOME = 30;
const DEV_START_CREDITS = Number(process.env.START_CREDITS) || 0; // 값이 있으면 방 설정보다 우선 (테스트용)
const VOTE_SECONDS = 25;
const BANKHACK_MAX = 50; // 계좌 해킹 최대 금액 (만)
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
    p.svcUses = {}; // 다크넷 서비스별 이용 횟수 (쓸수록 비싸짐)
    p.miner = 0; // 크립토 채굴기 남은 턴
    p.casino = null; // 카지노 기록 (하루 판 수, 손익 등)
    p.mercUsed = {}; // 용병: 쓴 능력 { strike, guard }
  });
  game.deepfakeUsed = false;
  game.itemSeq = 0;
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

  // 도감: 직업 · 경매 아이템 · 다크넷 · 카지노 설명 (모두 같은 내용)
  io.to("game:" + game.code).emit("catalog", {
    roles: ROLES,
    teams: TEAM_NAMES,
    pool: game.pool,
    items: ITEMS,
    services: SERVICES,
    casino: casino.GAMES,
    rules: {
      auction: AUCTION,
      serviceLimit: SERVICE_NIGHT_LIMIT,
      casino: casino.CASINO,
      landingDays: game.landingDays,
      bodyguardReward: 50,
    },
  });

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
      extra: p.bountyTarget
        ? "타깃: " + findPlayer(game, p.bountyTarget).name
        : p.role === "double"
          ? "VIP: " + (game.players.find((v) => v.role === "vip")?.name || "?")
          : "",
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
//  경제: 경매장, 다크넷, 송금(낮·밤), 카지노(낮)
// =====================================================

// 다음 날 낮에 적용되는 아이템 효과 묶음 (뇌물)
function emptyDayEffects() {
  return { bribes: new Set() };
}

// 1:1 메신저 해킹 상태 묶음 (밤마다 새로)
function emptyHacks() {
  return { taps: {}, scramble: new Set(), block: new Set() }; // taps = { 대상 id: Set(도청한 사람 id) }
}

// 한 사람에게 지금 쓸 수 있는 경제 정보 전송 (다크넷 가격, 송금 대상, 카지노, 채굴)
function sendEconomy(game, p) {
  if (!p.connected) return;
  const night = game.night;
  const usedTonight = game.phase === "night" && night ? night.svcCount[p.id] || 0 : 0;
  io.to(p.id).emit("economy", {
    credits: p.credits,
    available: available(game, p),
    players: alivePlayers(game).filter((t) => t !== p).map((t) => t.name),
    everyone: alivePlayers(game).map((t) => t.name),
    services: Object.keys(SERVICES).map((id) => {
      const s = SERVICES[id];
      const uses = p.svcUses[id] || 0;
      let lock = "";
      if (s.minDay && game.day < s.minDay) lock = s.minDay + "일차부터";
      else if (id === "drone" && p.hp >= maxHp(p)) lock = "체력 가득";
      return { id, name: s.name, desc: s.desc, target: s.target, price: servicePrice(id, uses), uses, lock };
    }),
    svcLeft: SERVICE_NIGHT_LIMIT - usedTonight,
    svcLimit: SERVICE_NIGHT_LIMIT,
    deepfakeTemplates: { injured: "OOO가 부상을 입었다!", healed: "리퍼닥이 OOO을(를) 치료했다!" },
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

// 카지노: 낮에만
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

// 지금 쓸 수 있는 돈 = 가진 돈 - 지금 최고가로 입찰 중인 금액 (낙찰되면 내야 하니 묶어 둠)
function available(game, p) {
  const lot = game.phase === "night" && game.night?.auction?.live;
  return p.credits - (lot && lot.leader === p.id ? lot.price : 0);
}

// =====================================================
//  경매장 (밤)
//  매일 밤 5건, 건당 20초, 공개 오름 경매. 연장 없음
//  무엇이 팔렸는지는 모두 공개, 누가 샀는지는 비공개 (입찰자는 "입찰자 A" 같은 익명 표시)
//  1인당 하룻밤 낙찰 2건까지
// =====================================================

// 오늘 밤 출품할 5건 (딥페이크는 게임당 1회라 이미 나왔으면 제외)
function rollLots(game) {
  // 테스트용: AUCTION_ITEMS=wiretap,forge 처럼 지정하면 그 아이템부터 출품
  const forced = process.env.AUCTION_ITEMS ? process.env.AUCTION_ITEMS.split(",").filter((id) => own(ITEMS, id)) : [];
  const pool = shuffle(Object.keys(ITEMS).filter((id) => !forced.includes(id) && !(id === "deepfake" && game.deepfakeUsed)));
  return [...forced, ...pool].slice(0, AUCTION.lots);
}

function startAuction(game) {
  const night = game.night;
  const letters = shuffle(alivePlayers(game).map((p) => p.id)); // 오늘 밤 익명 표시: 입찰자 A, B, C …
  night.auction = {
    lots: rollLots(game).map((id) => ({ id, status: "pending", price: ITEMS[id].price, leader: null, endsAt: 0 })),
    index: -1,
    live: null,
    wins: {}, // { id: 낙찰 수 }
    alias: Object.fromEntries(letters.map((id, i) => [id, "입찰자 " + "ABCDEFGHIJ"[i]])),
    timers: [],
  };
  night.auction.timers.push(setTimeout(() => nextLot(game), AUCTION.startDelay * 1000));
  sendAuctionAll(game);
}

function nextLot(game) {
  const a = game.night && game.night.auction;
  if (!a || game.phase !== "night") return;
  a.index++;
  if (a.index >= a.lots.length) {
    a.live = null;
    sendAuctionAll(game, { event: "done" });
    return;
  }
  const lot = a.lots[a.index];
  lot.status = "live";
  lot.endsAt = Date.now() + AUCTION.lotSeconds * 1000;
  a.live = lot;
  if (lot.id === "deepfake") game.deepfakeUsed = true; // 출품되면 다시 나오지 않음
  sendAuctionAll(game, { event: "lot" });
  lot.timer = setTimeout(() => endLot(game, lot), AUCTION.lotSeconds * 1000);
  a.timers.push(lot.timer);
}

// 경매가 밤 시간보다 길어질 것 같으면 밤을 늘리고 모두의 타이머를 고침
function extendNight(game) {
  const night = game.night;
  const a = night && night.auction;
  if (!a || game.phase !== "night") return;
  const now = Date.now();
  const pending = a.lots.filter((l) => l.status === "pending").length;
  const lotEnd = a.live ? a.live.endsAt : now + (a.index < 0 ? AUCTION.startDelay * 1000 : 0);
  const estimate = lotEnd + pending * (AUCTION.lotSeconds + AUCTION.gapSeconds) * 1000 + AUCTION.gapSeconds * 1000 + 3000;
  if (estimate <= night.endsAt) return;
  night.endsAt = estimate;
  io.to("game:" + game.code).emit("timer", Math.ceil((estimate - now) / 1000));
}

// 밤 끝: 경매가 아직이면 끝날 때까지 기다림
function tryEndNight(game) {
  const night = game.night;
  const left = night.endsAt - Date.now();
  if (left > 300) return schedule(game, left / 1000, () => tryEndNight(game));
  const a = night.auction;
  if (a && a.index < a.lots.length) {
    night.endsAt = Date.now() + 1000;
    return schedule(game, 1, () => tryEndNight(game));
  }
  startMorning(game);
}

function endLot(game, lot) {
  const a = game.night && game.night.auction;
  if (!a || a.live !== lot) return;
  a.live = null;
  const winner = findPlayer(game, lot.leader);
  if (winner && winner.alive && winner.credits >= lot.price) {
    lot.status = "sold";
    winner.credits -= lot.price;
    a.wins[winner.id] = (a.wins[winner.id] || 0) + 1;
    giveItem(game, winner, lot.id, lot.price);
    sendStatus(game);
  } else {
    lot.status = "unsold";
    lot.leader = null;
  }
  sendAuctionAll(game, { event: lot.status, item: lot.id });
  sendEconomyAll(game); // 묶여 있던 돈 풀림
  a.timers.push(setTimeout(() => nextLot(game), AUCTION.gapSeconds * 1000));
}

function stopAuction(game) {
  const a = game.night && game.night.auction;
  if (!a) return;
  for (const t of a.timers) clearTimeout(t);
  a.timers = [];
  a.live = null;
}

// 입찰: 현재가 + 입찰 단위 이상, 쓸 수 있는 돈 이하. 자기가 이미 최고가면 못 올림
function placeBid(game, me, data) {
  const a = game.night.auction;
  const lot = a && a.live;
  if (!lot || Number(data?.index) !== a.index) return econMsg(me, "지금 진행 중인 경매가 아니다.");
  if ((a.wins[me.id] || 0) >= AUCTION.winLimit) return econMsg(me, "오늘 밤 낙찰 한도(" + AUCTION.winLimit + "건)를 다 채웠다.");
  if (lot.leader === me.id) return econMsg(me, "이미 최고가 입찰자다.");
  const item = ITEMS[lot.id];
  const min = lot.leader ? lot.price + bidStep(item) : item.price;
  const amount = Number(data?.amount);
  if (!Number.isInteger(amount) || amount < min) return econMsg(me, "최소 " + min + "만부터 입찰할 수 있다.");
  if (amount > me.credits) return econMsg(me, "크레딧이 부족하다. (보유 " + me.credits + "만)");

  const prev = findPlayer(game, lot.leader);
  lot.price = amount;
  lot.leader = me.id;
  // 입찰이 들어오면 남은 시간을 최소 10초로 되돌림 (막판 눈치싸움)
  const extend = AUCTION.bidExtendSeconds * 1000;
  if (lot.endsAt - Date.now() < extend) {
    lot.endsAt = Date.now() + extend;
    clearTimeout(lot.timer);
    lot.timer = setTimeout(() => endLot(game, lot), extend);
    a.timers.push(lot.timer);
    extendNight(game);
  }
  sendAuctionAll(game, { event: "bid" });
  if (prev && prev !== me) {
    econMsg(prev, ITEMS[lot.id].name + ": 더 높은 입찰이 들어왔다. (" + amount + "만)");
    sendEconomy(game, prev);
  }
  sendEconomy(game, me);
}

// 경매 상태: 사람마다 "내가 최고가인지", 내 낙찰 수가 다르므로 한 명씩
function sendAuctionAll(game, extra = {}) {
  for (const p of game.players) if (p.connected) sendAuction(game, p, extra);
}

function sendAuction(game, p, extra = {}) {
  const a = game.night && game.night.auction;
  if (!a) return;
  const now = Date.now();
  io.to(p.id).emit("auction", {
    ...extra,
    index: a.index,
    winLimit: AUCTION.winLimit,
    myWins: a.wins[p.id] || 0,
    lotSeconds: AUCTION.lotSeconds,
    lots: a.lots.map((lot) => {
      const item = ITEMS[lot.id];
      return {
        id: lot.id,
        name: item.name,
        cat: item.cat,
        desc: item.desc,
        pitch: item.pitch,
        when: item.when,
        start: item.price,
        step: bidStep(item),
        status: lot.status,
        price: lot.price,
        leader: lot.leader ? a.alias[lot.leader] || "입찰자 ?" : null,
        mine: lot.leader === p.id,
        left: lot.status === "live" ? Math.max(0, lot.endsAt - now) : 0,
      };
    }),
  });
}

// ----- 낙찰품 -----
// 대상이 필요 없는 아이템은 바로 발동, 대상이 필요하면 "내 낙찰품"에 넣고 고르게 함
function giveItem(game, p, id, paid) {
  const item = ITEMS[id];
  econMsg(p, item.name + " 낙찰! (-" + paid + "만)" + (item.target === "none" ? " 효과가 바로 적용됐다." : " 경매장 아래 \"내 낙찰품\"에서 대상을 골라 사용하세요."));
  if (item.target === "none") return applyItem(game, p, id, {});
  const uid = ++game.itemSeq;
  game.night.inventory.push({ uid, owner: p.id, id });
  sendInventory(game, p);
}

function sendInventory(game, p) {
  const list = game.phase === "night" && game.night ? game.night.inventory.filter((it) => it.owner === p.id) : [];
  io.to(p.id).emit("inventory", list.map((it) => ({ uid: it.uid, id: it.id, name: ITEMS[it.id].name, target: ITEMS[it.id].target, desc: ITEMS[it.id].desc })));
}

// 낙찰품 사용: 아이템 종류에 맞는 값만 받음
function useItem(game, me, data) {
  const inv = game.night.inventory;
  const it = inv.find((x) => x.uid === Number(data?.uid) && x.owner === me.id);
  if (!it) return;
  const item = ITEMS[it.id];
  const alive = (name) => game.players.find((p) => p.name === name && p.alive);
  const payload = {};

  if (item.target === "player" || item.target === "deepfake" || item.target === "forge") {
    const t = alive(data.target);
    if (!t) return;
    if (item.target !== "deepfake" && t === me) return econMsg(me, "자기 자신은 고를 수 없다.");
    payload.target = t.id;
  }
  if (item.target === "deepfake") {
    if (!own(DEEPFAKE_TEMPLATES, data.kind)) return;
    payload.kind = data.kind;
  }
  if (item.target === "forge") {
    const to = alive(data.to);
    if (!to || to.id === payload.target) return econMsg(me, "받는 사람을 다시 고르세요.");
    payload.to = to.id;
  }
  if (item.target === "forge" || item.target === "text") {
    const text = String(data.text ?? "").trim().slice(0, 80);
    if (!text) return econMsg(me, "보낼 문장을 입력하세요.");
    payload.text = text;
  }

  game.night.inventory = inv.filter((x) => x !== it);
  applyItem(game, me, it.id, payload);
  sendInventory(game, me);
}

// 오늘 밤 이 사람에게 방화벽이 켜져 있는지
function hasFirewall(game, p) {
  const set = game.night.effects[p.id];
  return !!(set && set.has("firewall"));
}

// 해킹(채팅 해킹 · 계좌 해킹)이 방화벽에 막혔는지 확인하고, 막혔으면 양쪽에 알림
function hackBlocked(game, by, target, name) {
  if (!hasFirewall(game, target)) return false;
  econMsg(by, name + ": " + target.name + "의 방화벽에 막혔다.");
  econMsg(target, "방화벽이 누군가의 채팅 해킹을 막아냈다.");
  return true;
}

// 아이템 효과 등록
function applyItem(game, p, id, payload) {
  const night = game.night;
  const hacks = night.hacks;
  const item = ITEMS[id];
  const t = payload.target ? findPlayer(game, payload.target) : null;

  if (["proxy", "firewall", "armor", "decoy"].includes(id)) {
    (night.effects[p.id] = night.effects[p.id] || new Set()).add(id);
  } else if (id === "scanner") night.services.push({ type: "scanner", by: p.id, target: payload.target });
  else if (id === "translog") night.services.push({ type: "translog", by: p.id });
  else if (id === "bribe") game.tomorrow.bribes.add(p.id);
  else if (id === "miner") p.miner += MINER_TURNS;
  else if (id === "deepfake") night.deepfake = { kind: payload.kind, target: payload.target };
  else if (id === "speaker") night.speaker.push(payload.text);
  else if (id === "commlog") {
    if (hackBlocked(game, p, t, item.name)) return;
    night.commlogs.push({ by: p.id, target: t.id });
  } else if (id === "bankhack") {
    if (hackBlocked(game, p, t, item.name)) return;
    night.bankhacks.push({ by: p.id, target: t.id });
  } else if (id === "wiretap") {
    if (hackBlocked(game, p, t, item.name)) return;
    (hacks.taps[t.id] = hacks.taps[t.id] || new Set()).add(p.id);
    // 이미 오간 대화도 넘겨줌
    const past = night.dms.filter((m) => !m.forged && (m.from === t.name || m.to === t.name));
    io.to(p.id).emit("tapLog", { target: t.name, msgs: past });
  } else if (id === "scramble") {
    if (hackBlocked(game, p, t, item.name)) return;
    hacks.scramble.add(t.id);
  } else if (id === "block") {
    if (hackBlocked(game, p, t, item.name)) return;
    hacks.block.add(t.id);
    econMsg(t, "통신이 차단됐다! 오늘 밤엔 더 이상 1:1 메시지를 보낼 수 없다.");
  } else if (id === "forge") {
    if (hackBlocked(game, p, t, item.name)) return;
    const to = findPlayer(game, payload.to);
    deliverDM(game, t, to, payload.text, { forgedBy: p });
    econMsg(p, "메시지 위조 완료: " + t.name + "인 척 " + to.name + "에게 보냈다.");
    return;
  }
  if (item.target !== "none") {
    const who = t ? " → " + t.name : "";
    econMsg(p, item.name + " 사용" + who + (item.when === "morning" ? ". 결과는 아침에." : item.when === "now" ? ". 오늘 밤 동안 작동." : "."));
  }
}

// 1:1 메시지 전달 (해킹 효과 반영)
//  forgedBy: 메시지 위조로 보낸 경우 실제로 보낸 사람
function deliverDM(game, from, to, text, opt = {}) {
  const hacks = game.night.hacks;
  const night = game.night;
  // 채팅 교란: 보내는 사람이 교란당했으면 받는 쪽에는 글자 일부가 깨져 보임 (보낸 사람 화면은 원문)
  const shown = !opt.forgedBy && hacks.scramble.has(from.id) ? scrambleText(text) : text;
  const msg = { fromId: from.id, from: from.name, to: to.name, text: shown, channel: "dm" };
  night.dms.push({ from: from.name, to: to.name, text: shown, forged: !!opt.forgedBy });
  if (!opt.forgedBy) io.to(from.id).emit("dm", { ...msg, text });
  io.to(to.id).emit("dm", msg);
  if (opt.forgedBy) io.to(opt.forgedBy.id).emit("dm", { ...msg, forged: true });

  // 도청: 보낸 사람이나 받는 사람을 도청 중인 사람에게 사본 (대화 당사자는 제외)
  if (!opt.forgedBy) {
    const tappers = new Set([...(hacks.taps[from.id] || []), ...(hacks.taps[to.id] || [])]);
    for (const id of tappers) {
      const tapper = findPlayer(game, id);
      if (!tapper || !tapper.alive || id === from.id || id === to.id) continue;
      const target = hacks.taps[from.id]?.has(id) ? from.name : to.name;
      io.to(id).emit("dm", { ...msg, tap: target });
    }
  }
  // 사망자 관전 (위조는 위조라고 표시)
  for (const p of game.players) {
    if (!p.alive && p.connected) io.to(p.id).emit("dm", { ...msg, spectate: true, forged: !!opt.forgedBy });
  }
}

// 글자 40%를 ▒로 (공백은 그대로)
function scrambleText(text) {
  return [...text].map((ch) => (ch !== " " && Math.random() < 0.4 ? "▒" : ch)).join("");
}

// ----- 다크넷 서비스 -----
// 하룻밤 2건까지, 같은 서비스는 쓸 때마다 ×1.5
function useService(game, me, data) {
  const id = data?.service;
  const s = own(SERVICES, id);
  if (!s) return;
  const night = game.night;
  const price = servicePrice(id, me.svcUses[id]);
  if (s.minDay && game.day < s.minDay) return econMsg(me, s.name + ": " + s.minDay + "일차 밤부터 쓸 수 있다.");
  if ((night.svcCount[me.id] || 0) >= SERVICE_NIGHT_LIMIT) return econMsg(me, "다크넷은 하룻밤 " + SERVICE_NIGHT_LIMIT + "건까지만 이용할 수 있다.");
  if (id === "drone" && me.hp >= maxHp(me)) return econMsg(me, "의료 드론: 체력이 가득이라 치료할 곳이 없다.");
  if (available(game, me) < price) return econMsg(me, "크레딧이 부족하다." + (available(game, me) < me.credits ? " (입찰 중인 금액은 쓸 수 없음)" : ""));

  let target = null;
  if (s.target) {
    target = game.players.find((p) => p.name === data.target && p.alive);
    if (!target || target === me) return;
  }

  me.credits -= price;
  me.svcUses[id] = (me.svcUses[id] || 0) + 1;
  night.svcCount[me.id] = (night.svcCount[me.id] || 0) + 1;
  night.services.push({ type: id, by: me.id, target: target ? target.id : null });
  econMsg(me, s.name + " 의뢰 완료 (-" + price + "만)" + (target ? " → " + target.name : "") + ". 결과는 아침에. 다음 가격 " + servicePrice(id, me.svcUses[id]) + "만");
  sendStatus(game);
  sendEconomy(game, me);
}

// 송금: 바로 전달되고, 받는 사람은 보낸 사람을 알게 됨
function transfer(game, me, data) {
  const target = game.players.find((p) => p.name === data?.target && p.alive);
  const amount = validAmount(data?.amount, available(game, me)); // 입찰 중인 금액은 보낼 수 없음
  if (!target || target === me) return;
  if (!amount) return econMsg(me, "송금액을 확인하세요. (1 ~ " + available(game, me) + "만)");

  me.credits -= amount;
  target.credits += amount;
  if (game.phase === "night") game.night.transfers.push({ from: me.id, to: target.id, amount }); // 송금 로그는 밤 송금만
  econMsg(me, target.name + "에게 " + amount + "만 크레딧을 보냈다.");
  econMsg(target, me.name + "에게서 " + amount + "만 크레딧을 받았다.");
  sendStatus(game);
  sendEconomy(game, me);
  sendEconomy(game, target);
}

// 카지노 (casino.js가 판정). 결과는 이 사람에게만
function playCasino(game, me, data) {
  const res = casino.handle(me, game.day, data);
  io.to(me.id).emit("casinoResult", res);
  if (res.error) return;
  sendStatus(game);
  sendCasino(game, me);
}

function sendCasino(game, p) {
  if (p.connected) io.to(p.id).emit("casinoState", casino.publicState(p, game.day));
}

// 낮이 끝날 때 진행 중이던 카지노 판 정리
function settleCasino(game) {
  for (const p of game.players) {
    const r = casino.settle(p);
    if (r) econMsg(p, "낮이 끝나 " + casino.GAMES[r.game].name + " 판이 정리됐다. " + r.back + "만 돌려받음" + (r.gain ? " (+" + r.gain + ")" : ""));
  }
  sendStatus(game);
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
  const total = sequence.reduce((t, item) => t + (item.type === "executed" ? SECONDS_PER_EXECUTION : item.type ? SECONDS_PER_EVENT : SECONDS_PER_LINE), 0);
  return sec(Math.max(min, Math.ceil(3.5 + total))); // 3.5초: 단계 타이틀 카드 + 여유
}

// ----- 3. 밤 -----
// 직업 능력, 1:1 메신저, 경매장, 다크넷, 송금
function startNight(game) {
  game.night = {
    actions: {},
    attackVotes: {}, // 신디케이트 공격 투표 { 투표한 사람 id: 대상 id }
    effects: {}, // 오늘 밤 아이템 효과 { id: Set }
    services: [], // 다크넷 서비스, 아침에 결과가 나오는 아이템
    transfers: [],
    deepfake: null,
    dms: [], // 1:1 메신저 기록 { from, to, text, forged } (사망자 관전 · 도청 · 통신 기록용)
    hacks: emptyHacks(), // 채팅 도청 · 교란 · 차단
    inventory: [], // 대상을 아직 안 고른 낙찰품 { uid, owner, id }
    commlogs: [], // 통신 기록 열람 { by, target }
    speaker: [], // 선내 스피커 해킹 문장 (내일 아침 방송)
    svcCount: {}, // 오늘 밤 다크넷 이용 수 { id: n }
    bankhacks: [], // 계좌 해킹 { by, target } (아침에 처리)
    auction: null,
  };
  game.tomorrow = emptyDayEffects(); // 오늘 밤에 산 "내일 효과" 아이템

  const seconds = sec(game.settings.nightSeconds);

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

  game.night.endsAt = Date.now() + seconds * 1000;
  startAuction(game);
  extendNight(game); // 밤 시간이 경매보다 짧으면 늘림
  sendEconomyAll(game);
  for (const p of alivePlayers(game)) sendInventory(game, p);

  schedule(game, seconds, () => tryEndNight(game));
}

// ----- 4. 아침 발표 (CCTV) -----
function startMorning(game) {
  game.day++; // 아침이 오면 새 날
  stopAuction(game); // 밤이 끝나면 경매도 끝 (진행 중이던 건은 유찰)
  game.today = game.tomorrow; // 어젯밤 산 "내일 효과"가 오늘 적용됨

  const night = resolveNight(game);
  const tell = (id, text) => (night.priv[id] = night.priv[id] || []).push(text);

  // 통신 기록 열람: 대상이 밤새 대화한 상대 (위조 메시지는 대상이 보낸 게 아니라 빠짐)
  for (const c of game.night.commlogs) {
    const t = findPlayer(game, c.target);
    const partners = new Set();
    for (const m of game.night.dms) {
      if (m.forged) continue;
      if (m.from === t.name) partners.add(m.to);
      if (m.to === t.name) partners.add(m.from);
    }
    tell(c.by, "통신 기록: " + t.name + "이(가) 어젯밤 대화한 사람 → " + (partners.size ? [...partners].join(", ") : "아무도 없음"));
  }
  // 계좌 해킹: 대상 크레딧의 절반 (최대 50만). 털린 사람은 누가 했는지 모름
  for (const h of game.night.bankhacks) {
    const thief = findPlayer(game, h.by);
    const t = findPlayer(game, h.target);
    if (!thief || !thief.alive || !t || !t.alive) continue;
    const amount = Math.min(BANKHACK_MAX, Math.floor(t.credits / 2));
    t.credits -= amount;
    thief.credits += amount;
    tell(thief.id, "계좌 해킹 성공: " + t.name + "의 계좌에서 " + amount + "만을 빼냈다. (+" + amount + "만)");
    tell(t.id, "계좌가 털렸다! 누군가 " + amount + "만을 빼 갔다.");
  }
  // 쓰지 않은 낙찰품은 사라짐
  for (const it of game.night.inventory) tell(it.owner, ITEMS[it.id].name + "을(를) 쓰지 않아 효과 없이 사라졌다.");
  sendBoard(game);
  sendStatus(game);

  // 선내 방송 순서: { text } 는 글자만, { type, name } 이 있으면 복도에서 애니메이션도 재생
  const left = game.landingDays - game.day;
  const sequence = [];
  if (night.events.length) sequence.push(...night.events);
  else sequence.push({ text: night.lines[0] });
  // 선내 스피커 해킹: 출처 불명 방송
  for (const text of game.night.speaker) sequence.push({ text: "[출처 불명 방송] " + text });
  sequence.push({ text: left === 0 ? "오늘 투표가 끝나면 비행선이 착륙한다." : "착륙까지 " + left + "일 남았다." });
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
// 카지노 + 그룹 채팅 + 송금. 매일 낮이 시작될 때 수입 + 전날 카지노 손실 50% 반환
function startDay(game) {
  for (const p of alivePlayers(game)) {
    const back = casino.refund(p, game.day);
    if (back) econMsg(p, "어제 카지노 손실의 50%를 돌려받았다. (+" + back + "만)");
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
  sendEconomyAll(game);
  for (const p of alivePlayers(game)) sendCasino(game, p); // 오늘 남은 판 수 (하루 10판)

  schedule(game, seconds, () => {
    settleCasino(game);
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
  stopAuction(game); // 밤 중에 끝나면 경매 타이머도 정리

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
  // 방은 바로 로비로 (각자 결과 화면에서 "로비로 돌아가기"를 누르면 로비가 보임)
  backToLobby(game);
}

// 게임이 끝나면 방을 로비 상태로 되돌림 (설정은 그대로)
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
    p.svcUses = {};
    p.miner = 0;
    p.casino = null;
    p.mercUsed = {};
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
    if (game.night.hacks.block.has(me.id)) return socket.emit("dmBlocked");
    deliverDM(game, me, to, text);
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

  // ----- 경제 -----
  on("bid", (data) => {
    const ctx = nightPlayer(socket);
    if (ctx) placeBid(ctx.game, ctx.me, data);
  });
  on("useItem", (data) => {
    const ctx = nightPlayer(socket);
    if (ctx) useItem(ctx.game, ctx.me, data);
  });
  on("darknet", (data) => {
    const ctx = nightPlayer(socket);
    if (ctx) useService(ctx.game, ctx.me, data);
  });
  on("transfer", (data) => {
    const ctx = moneyPlayer(socket);
    if (ctx) transfer(ctx.game, ctx.me, data);
  });
  on("casino", (data) => {
    const ctx = casinoPlayer(socket);
    if (ctx) playCasino(ctx.game, ctx.me, data);
    else socket.emit("casinoResult", { error: "카지노는 낮에만 열려요." });
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
