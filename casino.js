// =====================================================
//  낮 카지노 6종 (서버 판정)
//  - 하루 10판, 판돈 1 ~ 50만 (1만 단위)
//  - 판돈을 걸면 끝날 때 "판돈 × 배당"을 돌려받음. 지면 배당 0 (판돈을 잃음)
//  - 대신 다음 날 낮이 시작될 때 "전날 순손실의 50%"를 돌려줌 (그 전에 죽으면 없음)
//    → 낮에 잃은 돈은 그날 밤 경매에 못 씀: "지금 지를까, 밤 경매용 돈을 지킬까"
//  - 배당은 50% 반환까지 넣어 계산했을 때 한 판 기대 수익이 약 +3~5%가 되도록 맞춤
//    (반환이 없으면 대부분 손해 → 올인 반복이 위험해짐)
//  - 결과는 전부 서버가 정함. 화면 연출은 결과를 보여 주는 것뿐
// =====================================================

const CASINO = { playsPerDay: 10, maxBet: 50, minBet: 1, refundRate: 0.5 };

const GAMES = {
  roulette:  { name: "룰렛",       odds: "색 ×1.6 · 구간 ×2.2 · 숫자 ×20" },
  slots:     { name: "슬롯",       odds: "2개 ×1.4 · 3개 ×4.5 · 777 ×25" },
  hilo:      { name: "하이로우",   odds: "맞힐 때마다 ×1.25 → ×3.5" },
  blackjack: { name: "블랙잭",     odds: "승 ×1.6 · 블랙잭 ×2 · 무 ×1" },
  rhythm:    { name: "리듬 채굴",  odds: "판돈 없음 · 정확도에 따라 0 ~ 15만", free: true },
  race:      { name: "드론 레이스", odds: "드론마다 ×1.6 ~ ×14" },
};

// ----- 룰렛: 0 ~ 36 -----
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_BETS = {
  red:   { label: "빨강",    mult: 1.6, win: (n) => RED.has(n) },
  black: { label: "검정",    mult: 1.6, win: (n) => n !== 0 && !RED.has(n) },
  low:   { label: "1 ~ 12",  mult: 2.2, win: (n) => n >= 1 && n <= 12 },
  mid:   { label: "13 ~ 24", mult: 2.2, win: (n) => n >= 13 && n <= 24 },
  high:  { label: "25 ~ 36", mult: 2.2, win: (n) => n >= 25 && n <= 36 },
  // number: 숫자 하나 → ×20
};
const ROULETTE_NUMBER_MULT = 20;

// ----- 슬롯: 기호별 나올 확률(가중치) -----
const SLOT_SYMBOLS = ["7", "♠", "◆", "★", "☢", "♣"];
const SLOT_WEIGHTS = [3, 4, 4, 4, 4, 4];
const SLOT_PAY = { none: 0, two: 1.4, three: 4.5, seven: 25 };

// ----- 하이로우: 맞힌 횟수별 배당 (5번 맞히면 자동 수령) -----
const HILO_STEPS = [1.25, 1.55, 2, 2.6, 3.5];
const CARD_NAMES = { 11: "J", 12: "Q", 13: "K", 14: "A" };

// ----- 블랙잭 -----
const BJ_PAY = { win: 1.6, natural: 2 };

// ----- 리듬 채굴: 노트 16개, 약 9초 -----
const RHYTHM = { notes: 16, first: 1200, last: 9200, minGap: 380, perfect: 70, good: 140, ok: 210, reward: 15 }; // 무료 채굴: 보상 = 15만 × 정확도² (0 ~ 15만)

// ----- 드론 레이스: 경주마다 4대의 우승 확률을 섞어서 배정 -----
//  배당 = 1 + (0.04 + 0.5 × 질 확률) / 이길 확률  → 50% 반환을 넣으면 어느 드론이든 기대 수익 +4%
const RACE_NAMES = ["볼트", "스팅어", "팬텀", "코멧"];
const RACE_PROBS = [0.5, 0.3, 0.16, 0.04];

// ----- 도우미 -----
const round2 = (x) => Math.round(x * 100) / 100;
const pickWeighted = (weights, rand) => {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
};
const drawCard = (rand) => 2 + Math.floor(rand() * 13); // 2 ~ 14(A), 덱은 무한 (카드 세기 불가)
const cardName = (v) => CARD_NAMES[v] || String(v);
const bjValue = (v) => (v === 14 ? 11 : v >= 10 ? 10 : v);
function handTotal(cards) {
  let total = cards.reduce((t, c) => t + bjValue(c), 0);
  let aces = cards.filter((c) => c === 14).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

// 플레이어의 카지노 기록 (날이 바뀌면 판 수 초기화)
function state(p, day) {
  if (!p.casino || p.casino.day !== day) {
    p.casino = { day, plays: 0, net: 0, active: null, race: p.casino?.race || null };
  }
  if (!p.casino.race) p.casino.race = newRaceCard(Math.random);
  return p.casino;
}

function newRaceCard(rand) {
  const probs = [...RACE_PROBS];
  for (let i = probs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [probs[i], probs[j]] = [probs[j], probs[i]];
  }
  return RACE_NAMES.map((name, i) => ({ name, p: probs[i], mult: Math.round((1 + (0.04 + 0.5 * (1 - probs[i])) / probs[i]) * 10) / 10 }));
}

// 화면에 보낼 카지노 상태
function publicState(p, day) {
  const s = state(p, day);
  return {
    plays: s.plays,
    playsLeft: CASINO.playsPerDay - s.plays,
    playsPerDay: CASINO.playsPerDay,
    maxBet: CASINO.maxBet,
    games: GAMES,
    rouletteBets: Object.fromEntries(Object.entries(ROULETTE_BETS).map(([k, b]) => [k, { label: b.label, mult: b.mult }])),
    rouletteNumberMult: ROULETTE_NUMBER_MULT,
    hiloSteps: HILO_STEPS,
    race: s.race.map((d) => ({ name: d.name, mult: d.mult, chance: Math.round(d.p * 100) })),
    active: s.active ? activeView(s.active) : null,
  };
}

// 진행 중인 판(하이로우 · 블랙잭 · 리듬)을 화면용으로
function activeView(a) {
  if (a.game === "hilo") return { game: "hilo", stake: a.stake, card: a.card, cardName: cardName(a.card), step: a.step };
  if (a.game === "blackjack") return { game: "blackjack", stake: a.stake, player: a.player.map(cardName), total: handTotal(a.player), dealerUp: cardName(a.dealer[0]) };
  if (a.game === "rhythm") return { game: "rhythm", stake: a.stake, notes: a.notes, duration: a.duration };
  return null;
}

// 판돈 확인 → 통과하면 차감하고 판 수 +1
//  반환: 오류 문장 또는 null
//  free = true 면 판돈 없이 판 수만 +1 (리듬 채굴: 0원이어도 할 수 있음)
function takeStake(p, s, stake, free) {
  if (s.active) return "진행 중인 게임을 먼저 끝내세요.";
  if (s.plays >= CASINO.playsPerDay) return "오늘은 " + CASINO.playsPerDay + "판을 모두 했다. 내일 다시!";
  if (free) {
    s.plays++;
    return null;
  }
  if (!Number.isInteger(stake) || stake < CASINO.minBet || stake > CASINO.maxBet) return "판돈은 " + CASINO.minBet + " ~ " + CASINO.maxBet + "만 사이로.";
  if (stake > p.credits) return "판돈이 보유 크레딧보다 많다.";
  p.credits -= stake;
  s.plays++;
  return null;
}

// 판 끝: 판돈 × 배당을 돌려줌 (배당은 1.0 이상이라 절대 손해 없음)
function payout(p, stake, mult) {
  const back = Math.round(stake * mult);
  p.credits += back;
  if (p.casino) p.casino.net += back - stake; // 오늘 손익 (다음 날 반환 계산용)
  return { mult: round2(mult), back, gain: back - stake };
}

// 새 낮이 시작될 때: 전날 순손실의 50% 반환. 반환한 금액을 돌려줌 (없으면 0)
function refund(p, day) {
  const s = p.casino;
  if (!s || s.day >= day || s.net >= 0) return 0;
  const amount = Math.round(-s.net * CASINO.refundRate);
  s.net = 0;
  p.credits += amount;
  return amount;
}

// =====================================================
//  한 번의 요청 처리
//  msg = { game, action, stake, ... }
//  반환 = { error } 또는 { game, ...결과 } (서버가 이 사람에게만 보냄)
// =====================================================
function handle(p, day, msg, rand = Math.random) {
  const s = state(p, day);
  const game = msg && msg.game;
  const action = (msg && msg.action) || "start";
  const stake = Number(msg && msg.stake);

  // ----- 룰렛 (한 번에 끝) -----
  if (game === "roulette") {
    const bet = msg.bet;
    let mult, label;
    if (bet === "number") {
      const pick = Number(msg.number);
      if (!Number.isInteger(pick) || pick < 0 || pick > 36) return { error: "0 ~ 36 사이 숫자를 고르세요." };
      label = "숫자 " + pick;
      const err = takeStake(p, s, stake);
      if (err) return { error: err };
      const n = Math.floor(rand() * 37);
      mult = n === pick ? ROULETTE_NUMBER_MULT : 0;
      return { game, n, color: n === 0 ? "green" : RED.has(n) ? "red" : "black", win: mult > 1, label, stake, ...payout(p, stake, mult) };
    }
    const b = Object.hasOwn(ROULETTE_BETS, bet) ? ROULETTE_BETS[bet] : null;
    if (!b) return { error: "베팅 종류를 고르세요." };
    const err = takeStake(p, s, stake);
    if (err) return { error: err };
    const n = Math.floor(rand() * 37);
    mult = b.win(n) ? b.mult : 0;
    return { game, n, color: n === 0 ? "green" : RED.has(n) ? "red" : "black", win: mult > 1, label: b.label, stake, ...payout(p, stake, mult) };
  }

  // ----- 슬롯 (한 번에 끝) -----
  if (game === "slots") {
    const err = takeStake(p, s, stake);
    if (err) return { error: err };
    const reels = [0, 1, 2].map(() => pickWeighted(SLOT_WEIGHTS, rand));
    const same = Math.max(...reels.map((r) => reels.filter((x) => x === r).length));
    let mult = SLOT_PAY.none;
    let kind = "none";
    if (same === 3 && reels[0] === 0) [mult, kind] = [SLOT_PAY.seven, "seven"];
    else if (same === 3) [mult, kind] = [SLOT_PAY.three, "three"];
    else if (same === 2) [mult, kind] = [SLOT_PAY.two, "two"];
    return { game, reels: reels.map((r) => SLOT_SYMBOLS[r]), kind, win: mult > 1, stake, ...payout(p, stake, mult) };
  }

  // ----- 드론 레이스 (한 번에 끝) -----
  if (game === "race") {
    const pick = s.race.findIndex((d) => d.name === msg.drone);
    if (pick < 0) return { error: "드론을 고르세요." };
    const err = takeStake(p, s, stake);
    if (err) return { error: err };
    const card = s.race;
    const winner = pickWeighted(card.map((d) => d.p), rand);
    // 나머지 순위는 아무렇게나 (연출용)
    const rest = card.map((_, i) => i).filter((i) => i !== winner).sort(() => rand() - 0.5);
    const order = [winner, ...rest].map((i) => card[i].name);
    const mult = winner === pick ? card[pick].mult : 0;
    s.race = newRaceCard(rand); // 다음 경주는 새 배당
    return { game, order, pick: card[pick].name, win: mult > 1, stake, ...payout(p, stake, mult) };
  }

  // ----- 하이로우 -----
  if (game === "hilo") {
    if (action === "start") {
      const err = takeStake(p, s, stake);
      if (err) return { error: err };
      s.active = { game, stake, card: drawCard(rand), step: 0 };
      return { game, action, active: activeView(s.active) };
    }
    const a = s.active;
    if (!a || a.game !== "hilo") return { error: "진행 중인 하이로우가 없다." };
    if (action === "guess") {
      const up = msg.dir === "up";
      if (msg.dir !== "up" && msg.dir !== "down") return { error: "높다 / 낮다를 고르세요." };
      const prev = a.card;
      const next = drawCard(rand);
      const ok = up ? next > prev : next < prev; // 같은 숫자는 틀린 것으로
      a.card = next;
      if (!ok) {
        s.active = null;
        return { game, action, prev: cardName(prev), next: cardName(next), ok, done: true, stake: a.stake, ...payout(p, a.stake, 0) };
      }
      a.step++;
      if (a.step >= HILO_STEPS.length) {
        s.active = null;
        return { game, action, prev: cardName(prev), next: cardName(next), ok, done: true, stake: a.stake, ...payout(p, a.stake, HILO_STEPS[HILO_STEPS.length - 1]) };
      }
      return { game, action, prev: cardName(prev), next: cardName(next), ok, done: false, active: activeView(a) };
    }
    if (action === "cash") {
      s.active = null;
      const mult = a.step > 0 ? HILO_STEPS[a.step - 1] : 1;
      return { game, action, done: true, stake: a.stake, ...payout(p, a.stake, mult) };
    }
    return { error: "알 수 없는 동작" };
  }

  // ----- 블랙잭 (딜러는 17 이상이면 멈춤) -----
  if (game === "blackjack") {
    const finish = (a, result, mult) => {
      s.active = null;
      return {
        game, action, done: true, result,
        player: a.player.map(cardName), total: handTotal(a.player),
        dealer: a.dealer.map(cardName), dealerTotal: handTotal(a.dealer),
        stake: a.stake, ...payout(p, a.stake, mult),
      };
    };
    if (action === "start") {
      const err = takeStake(p, s, stake);
      if (err) return { error: err };
      const a = (s.active = { game, stake, player: [drawCard(rand), drawCard(rand)], dealer: [drawCard(rand), drawCard(rand)] });
      const pNat = handTotal(a.player) === 21;
      const dNat = handTotal(a.dealer) === 21;
      if (pNat || dNat) {
        if (pNat && dNat) return finish(a, "push", 1);
        if (pNat) return finish(a, "natural", BJ_PAY.natural);
        return finish(a, "lose", 0);
      }
      return { game, action, done: false, active: activeView(a) };
    }
    const a = s.active;
    if (!a || a.game !== "blackjack") return { error: "진행 중인 블랙잭이 없다." };
    if (action === "hit") {
      a.player.push(drawCard(rand));
      const t = handTotal(a.player);
      if (t > 21) return finish(a, "bust", 0);
      if (t === 21) return dealerPlay(a);
      return { game, action, done: false, active: activeView(a) };
    }
    if (action === "stand") return dealerPlay(a);
    return { error: "알 수 없는 동작" };

    function dealerPlay(a) {
      while (handTotal(a.dealer) < 17) a.dealer.push(drawCard(rand));
      const pt = handTotal(a.player);
      const dt = handTotal(a.dealer);
      if (dt > 21 || pt > dt) return finish(a, "win", BJ_PAY.win);
      if (pt === dt) return finish(a, "push", 1);
      return finish(a, "lose", 0);
    }
  }

  // ----- 리듬 채굴 -----
  //  서버가 노트 시각을 정해서 보내고, 화면이 누른 시각을 돌려보냄 → 서버가 채점
  if (game === "rhythm") {
    if (action === "start") {
      const err = takeStake(p, s, 0, true);
      if (err) return { error: err };
      const notes = [];
      let t = RHYTHM.first;
      const span = (RHYTHM.last - RHYTHM.first) / (RHYTHM.notes - 1);
      for (let i = 0; i < RHYTHM.notes; i++) {
        notes.push(Math.round(t));
        t += Math.max(RHYTHM.minGap, span * (0.55 + rand() * 0.9));
      }
      const duration = notes[notes.length - 1] + 800;
      s.active = { game, stake: 0, notes, duration, startedAt: Date.now() };
      return { game, action, active: activeView(s.active) };
    }
    const a = s.active;
    if (!a || a.game !== "rhythm") return { error: "진행 중인 리듬 채굴이 없다." };
    if (action === "submit") {
      s.active = null;
      const elapsed = Date.now() - a.startedAt;
      const hits = Array.isArray(msg.hits) ? msg.hits.slice(0, 64).map(Number).filter((x) => Number.isFinite(x)) : [];
      // 너무 빨리 제출하면(끝까지 안 기다리면) 무효 → ×0
      const valid = elapsed >= a.duration - 1500;
      const used = new Set();
      let score = 0;
      const judges = a.notes.map((n) => {
        let best = -1;
        let bestDiff = Infinity;
        hits.forEach((h, i) => {
          const d = Math.abs(h - n);
          if (!used.has(i) && d < bestDiff) [best, bestDiff] = [i, d];
        });
        if (best < 0 || bestDiff > RHYTHM.ok) return "miss";
        used.add(best);
        if (bestDiff <= RHYTHM.perfect) { score += 1; return "perfect"; }
        if (bestDiff <= RHYTHM.good) { score += 0.6; return "good"; }
        score += 0.3;
        return "ok";
      });
      // 헛손질(노트 없는 곳을 누른 것)은 개당 0.25점 감점 → 연타로 점수 올리기 방지
      const extra = Math.max(0, hits.length - used.size);
      const acc = valid ? Math.max(0, Math.min(1, (score - extra * 0.25) / a.notes.length)) : 0;
      // 무료 채굴: 판돈 없이 정확도만큼 벌어 감 (손해 없음 · 카지노 손익에도 넣지 않음)
      const back = valid ? Math.round(RHYTHM.reward * acc * acc) : 0;
      p.credits += back;
      return { game, action, done: true, acc: Math.round(acc * 100), judges, stake: 0, mult: 0, back, gain: back };
    }
    return { error: "알 수 없는 동작" };
  }

  return { error: "알 수 없는 게임" };
}

// 낮이 끝날 때 진행 중이던 판 정리: 하이로우는 그때까지의 배당으로, 나머지는 판돈만 돌려줌
function settle(p) {
  const a = p.casino && p.casino.active;
  if (!a) return null;
  p.casino.active = null;
  const mult = a.game === "hilo" && a.step > 0 ? HILO_STEPS[a.step - 1] : 1;
  return { game: a.game, stake: a.stake, ...payout(p, a.stake, mult) };
}

module.exports = { CASINO, GAMES, handle, settle, refund, publicState, state, handTotal, RHYTHM, HILO_STEPS, SLOT_SYMBOLS };
