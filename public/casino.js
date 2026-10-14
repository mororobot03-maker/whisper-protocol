// =====================================================
//  위스퍼 프로토콜 - 낮 카지노 화면 (casino.js)
//  결과는 전부 서버가 정하고, 여기서는 받은 결과를 연출로 보여 줌
//  연출이 끝나기 전에는 크레딧 숫자가 바뀌지 않게 casinoHold를 켜 둠 (결과 미리 보기 방지)
//  client.js 다음에 불러옴 (socket, make, icon, sound, addLine, toast, setTab 등을 같이 씀)
// =====================================================
const cas = {
  head: document.querySelector("#cas-left"),
  range: document.querySelector("#bet-range"),
  view: document.querySelector("#bet-view"),
  minus: document.querySelector("#bet-minus"),
  plus: document.querySelector("#bet-plus"),
  quick: document.querySelector("#bet-quick"),
  games: document.querySelector("#cas-games"),
  table: document.querySelector("#cas-table"),
  result: document.querySelector("#cas-result"),
  state: null, // 서버가 보낸 카지노 상태 (남은 판, 배당표, 진행 중인 판)
  pendingState: null,
  game: "roulette", // 지금 고른 게임
  bet: 10, // 화면에 보이는 판돈 (가진 돈보다 많으면 줄어듦)
  want: 10, // 내가 고른 판돈 (돈이 다시 생기면 이 값으로 돌아감)
  busy: false, // 연출 중이거나 서버 응답 기다리는 중
  rouletteBet: "red",
  rouletteNumber: 7,
  wheelAngle: 0,
  rhythm: null, // 진행 중인 리듬 채굴 { notes, t0, hits, raf }
};

const GAME_ICONS = { roulette: "◎", slots: "7", hilo: "♠", blackjack: "21", rhythm: "♪", race: "▶" };
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ----- 연출 잠금: 켜져 있는 동안 크레딧 표시를 보류 -----
function hold(on) {
  cas.busy = on;
  casinoHold = on;
  if (!on) {
    flushStatus();
    if (cas.pendingState) applyState(cas.pendingState);
    cas.pendingState = null;
  }
  drawBetBar();
  drawGames();
}

// =====================================================
//  판돈
// =====================================================
function maxStake() {
  const max = cas.state ? cas.state.maxBet : 50;
  return Math.max(0, Math.min(max, myCredits));
}

function drawBetBar() {
  const max = maxStake();
  cas.bet = Math.max(Math.min(cas.want, max), max >= 1 ? 1 : 0);
  cas.range.max = Math.max(1, max);
  cas.range.value = cas.bet;
  cas.view.textContent = cas.bet;
  const free = !!(cas.state && cas.state.games[cas.game]?.free); // 리듬 채굴은 판돈이 없음
  const off = free || cas.busy || max < 1 || !!(cas.state && cas.state.active);
  for (const el of [cas.range, cas.minus, cas.plus, ...cas.quick.querySelectorAll("button")]) el.disabled = off;
}

function setWant(v) {
  cas.want = Math.max(1, Math.min(maxStake(), v));
  drawBetBar();
  if (!cas.rhythm && !cas.busy) drawTable(); // 버튼 글자의 판돈 갱신
}
cas.range.addEventListener("input", () => setWant(Number(cas.range.value)));
cas.minus.addEventListener("click", () => setWant(cas.bet - 1));
cas.plus.addEventListener("click", () => setWant(cas.bet + 1));
cas.quick.addEventListener("click", (e) => {
  const b = e.target.closest("[data-q]");
  if (!b) return;
  sound.play("click");
  setWant(b.dataset.q === "max" ? maxStake() : Number(b.dataset.q));
});

// =====================================================
//  게임 고르기
// =====================================================
function drawGames() {
  cas.games.innerHTML = "";
  if (!cas.state) return;
  const locked = cas.busy || !!cas.state.active;
  for (const id in cas.state.games) {
    const g = cas.state.games[id];
    const b = make("button", "cas-game" + (cas.game === id ? " on" : ""));
    b.type = "button";
    b.dataset.game = id;
    b.disabled = locked && cas.game !== id;
    b.appendChild(make("span", "cg-ico", GAME_ICONS[id]));
    b.appendChild(make("strong", null, g.name));
    b.appendChild(make("small", null, g.odds));
    cas.games.appendChild(b);
  }
  const left = cas.state.playsLeft;
  cas.head.textContent = "오늘 남은 판 " + left + " / " + cas.state.playsPerDay;
  cas.head.classList.toggle("empty", left <= 0);
}

cas.games.addEventListener("click", (e) => {
  const b = e.target.closest("[data-game]");
  if (!b || b.disabled || cas.game === b.dataset.game) return;
  cas.game = b.dataset.game;
  sound.play("tab");
  cas.result.textContent = "";
  drawBetBar();
  drawGames();
  drawTable();
});

// =====================================================
//  게임 판 그리기
// =====================================================
function noPlays() {
  return !cas.state || cas.state.playsLeft <= 0;
}

function playBtn(label, onClick, extraDisabled, free) {
  const b = make("button", "primary cas-play", label);
  b.type = "button";
  b.disabled = cas.busy || noPlays() || (!free && maxStake() < 1) || !!extraDisabled;
  b.addEventListener("click", onClick);
  return b;
}

function send(msg) {
  hold(true);
  socket.emit("casino", msg);
}

function drawTable() {
  cas.table.innerHTML = "";
  cas.table.className = "cas-table " + cas.game;
  if (!cas.state) return;
  const draw = { roulette: drawRoulette, slots: drawSlots, hilo: drawHilo, blackjack: drawBlackjack, rhythm: drawRhythm, race: drawRace }[cas.game];
  draw();
  if (noPlays()) cas.table.appendChild(make("p", "cas-note", "오늘은 10판을 모두 했어요. 내일 다시 열려요."));
}

// ----- 룰렛 -----
function wheelEl() {
  const wrap = make("div", "rl-wrap");
  const wheel = make("div", "rl-wheel");
  const seg = 360 / 37;
  const stops = WHEEL_ORDER.map((n, i) => {
    const c = n === 0 ? "#1f9d55" : RED_NUMBERS.has(n) ? "#c8283c" : "#16161f";
    return c + " " + (i * seg).toFixed(3) + "deg " + ((i + 1) * seg).toFixed(3) + "deg";
  });
  wheel.style.background = "conic-gradient(" + stops.join(",") + ")";
  WHEEL_ORDER.forEach((n, i) => {
    const label = make("span", "rl-num", String(n));
    label.style.transform = "rotate(" + ((i + 0.5) * seg) + "deg) translateY(-76px)";
    wheel.appendChild(label);
  });
  wheel.style.transform = "rotate(" + cas.wheelAngle + "deg)";
  wrap.appendChild(wheel);
  wrap.appendChild(make("i", "rl-pointer"));
  wrap.appendChild(make("span", "rl-center", ""));
  return wrap;
}

function drawRoulette() {
  cas.table.appendChild(wheelEl());
  const grid = make("div", "rl-bets");
  const bets = cas.state.rouletteBets;
  for (const key in bets) {
    const b = make("button", "rl-bet " + key + (cas.rouletteBet === key ? " on" : ""));
    b.type = "button";
    b.dataset.bet = key;
    b.appendChild(make("strong", null, bets[key].label));
    b.appendChild(make("small", null, "×" + bets[key].mult));
    grid.appendChild(b);
  }
  const num = make("label", "rl-bet number" + (cas.rouletteBet === "number" ? " on" : ""));
  num.dataset.bet = "number";
  const input = make("input");
  input.type = "number";
  input.min = 0;
  input.max = 36;
  input.value = cas.rouletteNumber;
  input.addEventListener("input", () => {
    cas.rouletteNumber = Math.max(0, Math.min(36, Math.floor(Number(input.value) || 0)));
    cas.rouletteBet = "number";
    for (const x of grid.querySelectorAll(".rl-bet")) x.classList.toggle("on", x.dataset.bet === "number");
  });
  num.append(make("strong", null, "숫자"), input, make("small", null, "×" + cas.state.rouletteNumberMult));
  grid.appendChild(num);
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-bet]");
    if (!b || cas.busy) return;
    cas.rouletteBet = b.dataset.bet;
    for (const x of grid.querySelectorAll(".rl-bet")) x.classList.toggle("on", x === b);
  });
  cas.table.appendChild(grid);
  cas.table.appendChild(playBtn("스핀 · " + cas.bet + "만", () => {
    send({ game: "roulette", bet: cas.rouletteBet, number: cas.rouletteNumber, stake: cas.bet });
    startWheel();
  }));
}

function startWheel() {
  const wheel = cas.table.querySelector(".rl-wheel");
  cas.table.querySelector(".rl-center").textContent = "";
  wheel.classList.add("spinning");
  sound.spin(2600);
}

async function showRoulette(r) {
  const wheel = cas.table.querySelector(".rl-wheel");
  await wait(700);
  const seg = 360 / 37;
  const center = (WHEEL_ORDER.indexOf(r.n) + 0.5) * seg;
  wheel.classList.remove("spinning");
  // 결과 칸이 위쪽 바늘에 오도록: 현재 각도에서 3바퀴 더 돌고 (360 - 칸 위치)에서 멈춤
  cas.wheelAngle = cas.wheelAngle - (cas.wheelAngle % 360) + 1080 + (360 - center);
  wheel.style.transform = "rotate(" + cas.wheelAngle + "deg)";
  await wait(2000);
  const c = cas.table.querySelector(".rl-center");
  c.textContent = r.n;
  c.className = "rl-center show " + r.color;
}

// ----- 슬롯 -----
function drawSlots() {
  const reels = make("div", "sl-reels");
  for (let i = 0; i < 3; i++) reels.appendChild(make("span", "sl-reel", "7"));
  cas.table.appendChild(reels);
  cas.table.appendChild(make("p", "cas-odds", "같은 그림 2개 ×1.4 · 3개 ×4.5 · 7 세 개 ×25 · 하나도 안 맞으면 판돈을 잃어요"));
  cas.table.appendChild(playBtn("레버 당기기 · " + cas.bet + "만", () => {
    send({ game: "slots", stake: cas.bet });
    startReels();
  }));
}

let reelTimer = null;
function startReels() {
  const reels = [...cas.table.querySelectorAll(".sl-reel")];
  reels.forEach((r) => r.classList.remove("stopped", "hit"));
  clearInterval(reelTimer);
  const SYM = ["7", "♠", "◆", "★", "☢", "♣"];
  reelTimer = setInterval(() => {
    for (const r of reels) if (!r.classList.contains("stopped")) r.textContent = SYM[Math.floor(Math.random() * SYM.length)];
  }, 70);
  sound.spin(1900);
}

async function showSlots(r) {
  const reels = [...cas.table.querySelectorAll(".sl-reel")];
  await wait(900);
  for (let i = 0; i < 3; i++) {
    await wait(320);
    reels[i].textContent = r.reels[i];
    reels[i].classList.add("stopped");
    sound.play("reel");
  }
  clearInterval(reelTimer);
  if (r.win) reels.forEach((el) => { if (r.reels.filter((x) => x === el.textContent).length > 1) el.classList.add("hit"); });
}

// ----- 하이로우 -----
function cardEl(name, cls) {
  const c = make("div", "hl-card " + (cls || ""));
  c.appendChild(make("b", null, name));
  return c;
}

function drawHilo() {
  const a = cas.state.active && cas.state.active.game === "hilo" ? cas.state.active : null;
  const steps = make("div", "hl-steps");
  cas.state.hiloSteps.forEach((m, i) => steps.appendChild(make("span", a && i < a.step ? "done" : a && i === a.step ? "next" : "", "×" + m)));
  cas.table.appendChild(steps);
  const row = make("div", "hl-row");
  row.appendChild(cardEl(a ? a.cardName : "?", a ? "" : "back"));
  cas.table.appendChild(row);
  if (!a) {
    cas.table.appendChild(make("p", "cas-odds", "다음 카드가 높을지 낮을지 맞히세요. 같은 숫자는 틀린 것. 맞힐 때마다 배당이 오르고 언제든 수령할 수 있지만, 틀리면 판돈을 잃어요."));
    cas.table.appendChild(playBtn("시작 · " + cas.bet + "만", () => send({ game: "hilo", stake: cas.bet })));
    return;
  }
  const btns = make("div", "hl-btns");
  const mk = (label, cls, msg) => {
    const b = make("button", cls, label);
    b.type = "button";
    b.disabled = cas.busy;
    b.addEventListener("click", () => send(msg));
    btns.appendChild(b);
  };
  mk("▲ 높다", "hl-up", { game: "hilo", action: "guess", dir: "up" });
  mk("▼ 낮다", "hl-down", { game: "hilo", action: "guess", dir: "down" });
  const cur = a.step > 0 ? cas.state.hiloSteps[a.step - 1] : 1;
  mk("수령 ×" + cur + " · " + Math.round(a.stake * cur) + "만", "hl-cash primary", { game: "hilo", action: "cash" });
  cas.table.appendChild(btns);
}

async function showHilo(r) {
  if (r.next) {
    const row = cas.table.querySelector(".hl-row");
    const next = cardEl(r.next, "flip " + (r.ok ? "ok" : "bad"));
    row.appendChild(next);
    sound.play("flip");
    await wait(900);
    sound.play(r.ok ? "coin" : "lose");
    await wait(300);
  }
}

// ----- 블랙잭 -----
function drawBlackjack() {
  const a = cas.state.active && cas.state.active.game === "blackjack" ? cas.state.active : null;
  const hand = (label, cards, total) => {
    const box = make("div", "bj-hand");
    box.appendChild(make("small", null, label + (total ? " · " + total : "")));
    const row = make("div", "bj-cards");
    cards.forEach((c) => row.appendChild(cardEl(c, c === "?" ? "back small" : "small")));
    box.appendChild(row);
    return box;
  };
  if (!a) {
    cas.table.appendChild(hand("딜러", ["?", "?"]));
    cas.table.appendChild(hand("나", ["?", "?"]));
    cas.table.appendChild(make("p", "cas-odds", "21에 가까우면 승리 ×1.6, 처음 두 장이 21이면 ×2, 비기면 판돈 그대로. 지면 판돈을 잃어요. 딜러는 17 이상이면 멈춰요."));
    cas.table.appendChild(playBtn("딜 · " + cas.bet + "만", () => send({ game: "blackjack", stake: cas.bet })));
    return;
  }
  cas.table.appendChild(hand("딜러", [a.dealerUp, "?"]));
  cas.table.appendChild(hand("나", a.player, a.total));
  const btns = make("div", "hl-btns");
  for (const [label, action] of [["히트 (한 장 더)", "hit"], ["스탠드 (멈춤)", "stand"]]) {
    const b = make("button", action === "stand" ? "primary" : "", label);
    b.type = "button";
    b.disabled = cas.busy;
    b.addEventListener("click", () => send({ game: "blackjack", action }));
    btns.appendChild(b);
  }
  cas.table.appendChild(btns);
}

async function showBlackjack(r) {
  if (!r.done) return;
  cas.table.innerHTML = "";
  const hand = (label, cards, total) => {
    const box = make("div", "bj-hand");
    box.appendChild(make("small", null, label + " · " + total));
    const row = make("div", "bj-cards");
    cards.forEach((c) => row.appendChild(cardEl(c, "small")));
    box.appendChild(row);
    return box;
  };
  cas.table.appendChild(hand("딜러", r.dealer, r.dealerTotal));
  cas.table.appendChild(hand("나", r.player, r.total));
  sound.play("flip");
  await wait(1000);
}

// ----- 리듬 채굴 -----
const FALL_MS = 1500; // 노트가 위에서 판정선까지 내려오는 시간

function drawRhythm() {
  const lane = make("div", "rh-lane");
  lane.appendChild(make("i", "rh-line"));
  lane.appendChild(make("span", "rh-judge"));
  cas.table.appendChild(lane);
  const tap = make("button", "rh-tap", "⛏ 채굴! (스페이스)");
  tap.type = "button";
  tap.disabled = !cas.rhythm;
  tap.addEventListener("pointerdown", (e) => { e.preventDefault(); rhythmHit(); });
  cas.table.appendChild(tap);
  if (!cas.rhythm) {
    cas.table.appendChild(make("p", "cas-odds", "내려오는 블록이 선에 닿을 때 누르세요. 16개 · 약 10초. 판돈 없이 정확도에 따라 0 ~ 15만을 캡니다 (돈이 없어도 OK · 하루 판 수에 포함 · 헛손질은 감점)."));
    cas.table.appendChild(playBtn("무료 채굴 시작", () => send({ game: "rhythm" }), false, true));
  }
}

function startRhythm(active) {
  cas.rhythm = { notes: active.notes, duration: active.duration, t0: performance.now(), hits: [], judged: new Set() };
  drawTable();
  const lane = cas.table.querySelector(".rh-lane");
  const els = active.notes.map(() => {
    const n = make("i", "rh-note");
    lane.appendChild(n);
    return n;
  });
  const frame = () => {
    const r = cas.rhythm;
    if (!r) return;
    const t = performance.now() - r.t0;
    const h = lane.clientHeight;
    const lineY = h - 34;
    r.notes.forEach((nt, i) => {
      const y = lineY - ((nt - t) / FALL_MS) * lineY;
      els[i].style.transform = "translateY(" + y + "px)";
      els[i].style.opacity = y < -20 || r.judged.has(i) ? 0 : 1;
      if (!r.judged.has(i) && t - nt > 210) {
        r.judged.add(i);
        judge("MISS", "miss");
      }
    });
    if (t >= r.duration) return finishRhythm();
    r.raf = requestAnimationFrame(frame);
  };
  cas.rhythm.raf = requestAnimationFrame(frame);
}

function rhythmHit() {
  const r = cas.rhythm;
  if (!r) return;
  const t = performance.now() - r.t0;
  r.hits.push(Math.round(t));
  // 화면용 판정 (진짜 채점은 서버가 함)
  let best = -1;
  let diff = Infinity;
  r.notes.forEach((nt, i) => {
    const d = Math.abs(nt - t);
    if (!r.judged.has(i) && d < diff) [best, diff] = [i, d];
  });
  if (best >= 0 && diff <= 210) {
    r.judged.add(best);
    if (diff <= 70) judge("PERFECT", "perfect");
    else if (diff <= 140) judge("GOOD", "good");
    else judge("OK", "ok");
    sound.play("click");
  } else judge("헛손질", "miss");
}

function judge(text, cls) {
  const el = cas.table.querySelector(".rh-judge");
  if (!el) return;
  el.textContent = text;
  el.className = "rh-judge " + cls;
  el.getBoundingClientRect();
  el.classList.add("pop");
}

function finishRhythm() {
  const r = cas.rhythm;
  if (!r) return;
  cancelAnimationFrame(r.raf);
  cas.rhythm = null;
  send({ game: "rhythm", action: "submit", hits: r.hits });
}

function stopRhythm() {
  if (cas.rhythm) cancelAnimationFrame(cas.rhythm.raf);
  cas.rhythm = null;
}

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || !cas.rhythm) return;
  if (e.target.matches("input, textarea")) return;
  e.preventDefault();
  if (!e.repeat) rhythmHit();
});

// ----- 드론 레이스 -----
let racePick = null;
function drawRace() {
  const track = make("div", "rc-track");
  for (const d of cas.state.race) {
    const lane = make("button", "rc-lane" + (racePick === d.name ? " on" : ""));
    lane.type = "button";
    lane.dataset.drone = d.name;
    const info = make("span", "rc-info");
    info.appendChild(make("strong", null, d.name));
    info.appendChild(make("small", null, "×" + d.mult + " · 우승 " + d.chance + "%"));
    lane.appendChild(info);
    const drone = make("span", "rc-drone", "🛸");
    lane.appendChild(drone);
    lane.appendChild(make("i", "rc-finish"));
    track.appendChild(lane);
  }
  track.addEventListener("click", (e) => {
    const b = e.target.closest("[data-drone]");
    if (!b || cas.busy) return;
    racePick = b.dataset.drone;
    sound.play("click");
    for (const x of track.querySelectorAll(".rc-lane")) x.classList.toggle("on", x === b);
    const btn = cas.table.querySelector(".cas-play");
    if (btn) {
      btn.disabled = cas.busy || noPlays() || maxStake() < 1;
      btn.textContent = racePick + "에 " + cas.bet + "만";
    }
  });
  cas.table.appendChild(track);
  cas.table.appendChild(playBtn(racePick ? racePick + "에 " + cas.bet + "만" : "드론을 고르세요", () => send({ game: "race", drone: racePick, stake: cas.bet }), !racePick || !cas.state.race.some((d) => d.name === racePick)));
}

async function showRace(r) {
  const lanes = [...cas.table.querySelectorAll(".rc-lane")];
  sound.play("fly");
  const anims = lanes.map((lane) => {
    const name = lane.dataset.drone;
    const place = r.order.indexOf(name);
    const drone = lane.querySelector(".rc-drone");
    const end = lane.clientWidth - 46 - 104; // 이름표(왼쪽 104px) 오른쪽에서 출발
    const time = 3000 + place * 260;
    // 중간에 순위가 뒤집히는 것처럼 보이도록 중간 지점은 무작위
    const mid = 0.35 + Math.random() * 0.35;
    return drone.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(" + end * mid + "px)", offset: 0.5 },
        { transform: "translateX(" + end + "px)" },
      ],
      { duration: time, easing: "ease-in-out", fill: "forwards" }
    ).finished;
  });
  await Promise.all(anims);
  lanes.find((l) => l.dataset.drone === r.order[0])?.classList.add("winner");
  await wait(1600); // 결승 장면을 잠깐 보여 준 뒤 다음 경주 배당으로
}

// =====================================================
//  서버 응답
// =====================================================
function applyState(st) {
  cas.state = st;
  drawBetBar();
  drawGames();
  if (st.active && st.active.game !== cas.game) cas.game = st.active.game; // 진행 중인 판이 있으면 그 게임 화면으로
  if (!cas.rhythm) drawTable();
}

socket.on("casinoState", (st) => {
  if (cas.busy) cas.pendingState = st; // 연출이 끝난 뒤 반영 (남은 판 수 등)
  else applyState(st);
});

socket.on("casinoResult", async (r) => {
  if (r.error) {
    cas.result.textContent = r.error;
    cas.result.className = "cas-result lose";
    sound.play("error");
    clearInterval(reelTimer);
    cas.table.querySelector(".rl-wheel")?.classList.remove("spinning");
    hold(false);
    drawTable();
    return;
  }
  // 진행형 게임: 다음 단계 화면
  if (r.game === "rhythm" && r.action === "start") {
    hold(false);
    startRhythm(r.active);
    return;
  }
  if (r.game === "roulette") await showRoulette(r);
  else if (r.game === "slots") await showSlots(r);
  else if (r.game === "race") await showRace(r);
  else if (r.game === "hilo") await showHilo(r);
  else if (r.game === "blackjack") await showBlackjack(r);

  if (r.done === false || (r.active && !("back" in r))) {
    // 아직 판이 끝나지 않음 (하이로우 맞힘, 블랙잭 히트 등)
    cas.state.active = r.active;
    cas.result.textContent = r.game === "hilo" && r.ok ? "맞혔다! 계속할까, 수령할까?" : "";
    cas.result.className = "cas-result";
    hold(false);
    drawTable();
    return;
  }
  if ("back" in r) {
    cas.state.active = null;
    const name = cas.state.games[r.game].name;
    let text;
    if (r.game === "rhythm") text = "정확도 " + r.acc + "% · 채굴";
    else if (r.game === "blackjack") text = { natural: "블랙잭!", win: "승리!", push: "무승부", lose: "딜러 승", bust: "버스트 (21 초과)" }[r.result] + " ×" + r.mult;
    else if (r.game === "roulette") text = r.n + (r.color === "red" ? " 빨강" : r.color === "black" ? " 검정" : " 초록") + " · " + (r.win ? "적중! ×" + r.mult : "빗나감");
    else if (r.game === "race") text = r.order[0] + " 우승 · " + (r.win ? "적중! ×" + r.mult : "빗나감");
    else if (r.game === "hilo") text = r.mult > 0 ? "수령 ×" + r.mult : "틀렸다";
    else text = r.win ? "당첨! ×" + r.mult : "꽝";
    const money = r.gain > 0 ? "+" + r.gain + "만" : r.gain < 0 ? "−" + -r.gain + "만 (내일 절반 반환)" : r.game === "rhythm" ? "0만" : "본전";
    cas.result.textContent = text + " → " + money;
    cas.result.className = "cas-result " + (r.gain > 0 ? "win" : "lose");
    sound.play(r.gain > 0 ? "win" : "lose");
    addLine("◆ 카지노 " + name + ": " + text + " " + money, "system econ");
  }
  hold(false);
  drawTable();
});

// 단계가 바뀔 때: 낮이 아니면 진행 중이던 연출 정리
function casinoPhase(data) {
  if (data.phase !== "day") {
    stopRhythm();
    clearInterval(reelTimer);
    if (cas.busy) hold(false);
    if (cas.state) cas.state.active = null;
  }
  drawBetBar();
}

drawBetBar();
