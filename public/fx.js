// =====================================================
//  위스퍼 프로토콜 - 연출 (fx.js)
//  게임 규칙과 상관없는 "보여주기"만 담당
//   1. 객실 복도 + 사건 애니메이션 + 선내 방송
//   2. 시작 연출 (이륙 → 직업 카드)
//   3. 카지노 애니메이션 (룰렛, 슬롯)
//   4. 게임 결과 화면 + 축하
// =====================================================

const fx = {
  deck: document.querySelector("#deck"),
  rooms: document.querySelector("#rooms"),
  lift: document.querySelector("#lift"),
  walker: document.querySelector("#walker"),
  broadcast: document.querySelector("#broadcast"),
  bcText: document.querySelector("#bc-text"),
  intro: document.querySelector("#intro"),
  cardFront: document.querySelector("#card-front"),
  shipName: document.querySelector("#ship-name"),
  wheel: document.querySelector("#wheel"),
  reels: document.querySelector("#reels"),
  casinoResult: document.querySelector("#casino-result"),
  result: document.querySelector("#result"),
  confetti: document.querySelector("#confetti"),
};

// 움직임 줄이기 설정을 켠 사람은 애니메이션 없이 결과만
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, calm ? Math.min(ms, 300) : ms));

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// =====================================================
//  0. 플레이어 색 토큰
//  입장 순서대로 서버가 0~9 번호를 주고, 화면은 그 번호의 색을 씀
//  팀 색(시안/빨강/노랑)과 헷갈리지 않도록 채도를 맞춘 별도 팔레트
// =====================================================
const PLAYER_COLORS = [
  "#ff8a5c", "#7ee081", "#5cb8ff", "#c38cff", "#ffd86b",
  "#ff7eb6", "#4fe3d0", "#a3b4ff", "#e6a15c", "#d6dde8",
];
const colorByName = {}; // { 이름: 색 번호 }
const avatarByName = {}; // { 이름: 캐릭터 꾸미기 정보 }

function rememberColors(players) {
  for (const p of players) {
    colorByName[p.name] = p.color;
    if (p.avatar) avatarByName[p.name] = p.avatar;
  }
}

function colorOf(name) {
  const i = colorByName[name];
  return i === undefined ? "#8a8aa0" : PLAYER_COLORS[i % PLAYER_COLORS.length];
}

// 사람 표시: 꾸민 캐릭터 (플레이어 색 고리 안에). 캐릭터 정보가 없거나 "???"(보이스 마스크)면 글자 토큰
function token(name, small) {
  const t = el("span", "token" + (small ? " sm" : ""));
  t.setAttribute("aria-hidden", "true");
  if (name !== "???" && avatarByName[name]) {
    t.classList.add("has-avatar");
    t.style.setProperty("--c", colorOf(name));
    t.appendChild(avatarImg(avatarByName[name]));
  } else {
    t.textContent = name === "???" ? "?" : name.charAt(0).toUpperCase();
    t.style.setProperty("--c", name === "???" ? "#5a5a6e" : colorOf(name));
  }
  return t;
}

// 토큰 + 색 이름 한 묶음
function nameTag(name, small) {
  const wrap = el("span", "name-tag");
  wrap.appendChild(token(name, small));
  const label = el("span", "name", name);
  if (name !== "???") label.style.color = colorOf(name);
  wrap.appendChild(label);
  return wrap;
}

// =====================================================
//  1. 객실
//   - 상단 띠: 생존 현황을 늘 보여주는 작은 객실 줄
//   - 선내 지도: 가운데 홀(해치)을 객실들이 빙 둘러싼 지도
//     밤에는 능력 탭에서 방을 눌러 대상을 고르고,
//     아침/투표 결과 때는 화면 가운데로 옮겨져 사건을 재생함
// =====================================================

let myName = "";

const map = {
  el: document.querySelector("#shipmap"),
  rooms: document.querySelector("#mrooms"),
  hatch: document.querySelector("#hatch"),
  fx: document.querySelector("#map-fx"),
  walker: document.querySelector("#mwalker"),
  home: document.querySelector("#action-map"), // 평소 지도가 있는 자리
};

// =====================================================
//  지도 무대: 공개 발언·투표 때 채팅 칸 위에 지도를 크게
// =====================================================
const stage = {
  el: document.querySelector("#map-stage"),
  slot: document.querySelector("#map-stage-slot"),
  title: document.querySelector("#stage-title"),
  hint: document.querySelector("#stage-hint"),
  mode: null, // "speech" | "vote" | null
  speaker: null,
  votable: new Set(),
  picked: null,
};

// 지금 지도가 있어야 할 자리 (무대가 열려 있으면 무대, 아니면 능력 탭)
function mapHome() {
  return stage.mode ? stage.slot : map.home;
}

function showStage(mode, opts = {}) {
  stage.mode = mode;
  stage.speaker = opts.speaker || null;
  stage.votable = new Set(opts.candidates || []);
  if (mode !== "vote") stage.picked = null;
  stage.title.textContent = opts.title || "";
  stage.hint.textContent = opts.hint || "";
  stage.el.classList.remove("hidden");
  stage.el.dataset.mode = mode;
  if (replay.el.classList.contains("hidden")) stage.slot.appendChild(map.el); // 재생 중이면 끝난 뒤 옮겨짐
  applyStageMarks();
}

function hideStage() {
  stage.mode = null;
  stage.speaker = null;
  stage.votable = new Set();
  stage.picked = null;
  stage.el.classList.add("hidden");
  if (map.el.parentElement === stage.slot) map.home.appendChild(map.el);
  for (const b of map.fx.querySelectorAll(".map-bubble")) b.remove();
  applyStageMarks();
}

// 발언자 강조, 투표 가능 / 내가 찍은 방 표시
function applyStageMarks() {
  for (const room of map.rooms.querySelectorAll(".mroom")) {
    const name = room.dataset.name;
    room.classList.toggle("speaking", stage.mode === "speech" && name === stage.speaker);
    room.classList.toggle("votable", stage.mode === "vote" && stage.votable.has(name));
    room.classList.toggle("voted-pick", stage.mode === "vote" && name === stage.picked);
  }
  map.el.classList.toggle("speech-mode", stage.mode === "speech");
  map.el.classList.toggle("vote-mode", stage.mode === "vote" && stage.votable.size > 0);
}

function setVotePick(name) {
  stage.picked = name;
  applyStageMarks();
}

// 지도 위 말풍선: 말한 사람 방 위에 띄움
function mapSay(name, text) {
  const room = roomOf(name);
  if (!room || map.el.parentElement !== stage.slot) return;
  map.fx.querySelector('.map-bubble[data-name="' + CSS.escape(name) + '"]')?.remove();
  const at = posIn(room);
  const b = el("span", "map-bubble", text.length > 60 ? text.slice(0, 59) + "…" : text);
  b.dataset.name = name;
  b.style.left = at.x + "px";
  b.style.top = at.y - room.offsetHeight / 2 - 4 + "px";
  // 지도 오른쪽/왼쪽 끝 방이면 꼬리 방향만 바꿈
  const w = map.el.clientWidth;
  if (at.x < w * 0.25) b.classList.add("left");
  if (at.x > w * 0.75) b.classList.add("right");
  map.fx.appendChild(b);
  setTimeout(() => b.remove(), 6000);
}

const replay = {
  el: document.querySelector("#replay"),
  head: document.querySelector("#replay-head"),
  slot: document.querySelector("#replay-slot"),
  sub: document.querySelector("#replay-sub"),
};

// 생존 현황이 바뀔 때마다 띠와 지도를 다시 그림
function renderRooms(players) {
  rememberColors(players);

  fx.rooms.innerHTML = "";
  for (const p of players) {
    const room = el("button", "room" + (p.alive ? "" : " dead") + (p.name === myName ? " me" : ""));
    room.type = "button";
    room.dataset.name = p.name;
    room.style.setProperty("--c", colorOf(p.name));
    room.setAttribute("aria-label", p.name + (p.alive ? "" : " (사망)"));
    room.appendChild(token(p.name, true));
    room.appendChild(el("span", "plate", p.name));
    fx.rooms.appendChild(room);
  }

  renderMap(players);
  if (typeof refreshTargeting === "function") refreshTargeting(); // 대상 선택 표시 다시 입히기
}

// 방을 타원 둘레에 고르게 배치 (맨 위에서 시작해 시계 방향)
function renderMap(players) {
  map.rooms.innerHTML = "";
  const n = players.length;
  players.forEach((p, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const room = el("button", "mroom" + (p.alive ? "" : " dead") + (p.name === myName ? " me" : ""));
    room.type = "button";
    room.dataset.name = p.name;
    room.style.left = 50 + Math.cos(angle) * 38 + "%";
    room.style.top = 50 + Math.sin(angle) * 37 + "%";
    room.style.setProperty("--c", colorOf(p.name));
    room.setAttribute("aria-label", p.name + "의 방" + (p.alive ? "" : " (비어 있음)"));
    if (avatarByName[p.name]) room.appendChild(avatarImg(avatarByName[p.name], "mavatar"));
    else room.appendChild(el("span", "mtoken", p.name.charAt(0).toUpperCase()));
    room.appendChild(el("span", "mname", p.name));
    map.rooms.appendChild(room);
  });
  if (typeof applyStageMarks === "function") applyStageMarks(); // 다시 그려도 발언자·투표 표시 유지
}

function roomOf(name) {
  return map.rooms.querySelector('.mroom[data-name="' + CSS.escape(name) + '"]');
}
function stripRoomOf(name) {
  return fx.rooms.querySelector('.room[data-name="' + CSS.escape(name) + '"]');
}
function setDead(name, dead) {
  for (const r of [roomOf(name), stripRoomOf(name)]) if (r) r.classList.toggle("dead", dead);
}

// 지도 안에서의 위치(px)
function posIn(target) {
  const a = map.el.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 };
}

function place(elm, p) {
  elm.style.left = p.x + "px";
  elm.style.top = p.y + "px";
}

// 지도 위에 잠깐 나타났다 사라지는 효과 (베기, 치료 십자 등)
function burst(className, text, at, keyframes, duration) {
  const s = el("span", className, text);
  place(s, at);
  map.fx.appendChild(s);
  const anim = s.animate(keyframes, { duration: calm ? 1 : duration, easing: "ease-out", fill: "forwards" });
  anim.finished.then(() => s.remove());
  return anim.finished;
}

// 실루엣: 가운데 해치에서 솟아올라 방 앞까지 걸어감 → 돌아가는 함수를 돌려줌
// 모두 같은 해치에서 나오므로 누가 어느 방에서 나왔는지는 보이지 않음 (정체 보호)
async function figureTo(room, kind) {
  const w = map.walker;
  const center = posIn(map.hatch);
  const r = posIn(room);
  const door = { x: center.x + (r.x - center.x) * 0.72, y: center.y + (r.y - center.y) * 0.72 }; // 방 문 바로 앞

  w.className = "mwalker " + kind;
  w.style.transition = "none";
  place(w, center);
  w.getBoundingClientRect(); // 위치를 먼저 적용
  w.style.transition = "";
  map.hatch.className = "hatch open " + kind;

  w.classList.add("rise");
  await sleep(450);
  w.classList.add("walking");
  place(w, door);
  for (let i = 0; i < 4; i++) sound.play("step", i * 220);
  await sleep(900);
  w.classList.remove("walking");

  return async () => {
    w.classList.add("walking");
    place(w, center);
    await sleep(650);
    w.classList.remove("walking", "rise");
    await sleep(250);
    map.hatch.className = "hatch";
  };
}

// 처형: 4단계 연출 (약 7초)
//  1) 판결   주변이 어두워지고 그 방에만 스포트라이트
//  2) 경고   경보 + "에어락 개방 3, 2, 1" 카운트다운
//  3) 추방   문이 열리고 캐릭터가 빙글빙글 돌며 빨려 나감
//  4) 정적   소리가 끊기고 "추방되었다" (+ 옵션에 따라 직업 공개)
async function playExecution(item, room, at) {
  const t = (ms) => (calm ? Math.min(ms, 300) : ms);

  // 1) 판결
  replay.sub.textContent = "판결이 내려졌다…";
  replay.sub.className = "replay-sub bad";
  map.el.classList.add("verdict");
  room.classList.add("spotlight");
  await sleep(t(1500));

  // 2) 경고: 카운트다운
  map.el.classList.add("alarm");
  room.classList.add("breach");
  sound.play("alarm");
  replay.sub.textContent = "에어락 개방";
  const center = posIn(map.hatch);
  for (const n of [3, 2, 1]) {
    sound.play("tickLast");
    burst("countdown", String(n), center, [
      { transform: "translate(-50%,-50%) scale(1.8)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%,-50%) scale(0.9)", opacity: 0 },
    ], 650);
    await sleep(t(650));
  }

  // 3) 추방: 비행선 밖으로 날아가는 그 사람의 캐릭터
  const dx = at.x - center.x;
  const dy = at.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  const far = Math.max(map.el.clientWidth, map.el.clientHeight) * 1.2;
  const flyer = el("span", "flyer");
  flyer.style.setProperty("--c", colorOf(item.name));
  if (avatarByName[item.name]) flyer.appendChild(avatarImg(avatarByName[item.name]));
  else flyer.textContent = item.name.charAt(0).toUpperCase();
  room.classList.add("dead"); // 방은 비고, 캐릭터만 날아감
  room.classList.remove("spotlight");
  setDead(item.name, true);
  place(flyer, at);
  map.fx.appendChild(flyer);
  sound.play("fly");
  await flyer.animate(
    [
      { transform: "translate(-50%,-50%) rotate(0) scale(1.2)", opacity: 1 },
      { transform: "translate(calc(-50% + " + (dx / len) * 18 + "px), calc(-50% + " + (dy / len) * 18 + "px)) rotate(-25deg) scale(1.25)", opacity: 1, offset: 0.25 },
      { transform: "translate(calc(-50% + " + (dx / len) * far + "px), calc(-50% + " + (dy / len) * far + "px)) rotate(720deg) scale(0.3)", opacity: 0 },
    ],
    { duration: calm ? 1 : 2000, easing: "cubic-bezier(.5,0,.9,.4)", fill: "forwards" }
  ).finished;
  flyer.remove();

  // 4) 정적
  room.classList.remove("breach");
  map.el.classList.remove("alarm", "verdict");
  replay.sub.textContent = item.text;
  if (item.role) {
    const line = el("span", "sub-role");
    line.append(roleIcon(item.roleId), " 직업: " + item.role);
    replay.sub.appendChild(line);
  }
  return sleep(t(1800));
}

// 사건 하나 재생
async function playEvent(item) {
  const room = roomOf(item.name);
  if (!room) return sleep(1600);
  const at = posIn(room);

  if (item.type === "executed") return playExecution(item, room, at);

  const kind = item.type === "healed" ? "medic" : "attacker";
  const goBack = await figureTo(room, kind);

  if (kind === "attacker") {
    room.classList.add("fx-hit");
    sound.play("slash");
    burst("slash", "", at, [
      { transform: "translate(-50%,-50%) rotate(-35deg) scaleX(0)", opacity: 1 },
      { transform: "translate(-50%,-50%) rotate(-35deg) scaleX(1.2)", opacity: 1, offset: 0.4 },
      { transform: "translate(-50%,-50%) rotate(-35deg) scaleX(1.4)", opacity: 0 },
    ], 600);
  } else {
    room.classList.add("fx-heal");
    sound.play("heal");
    burst("plus", "✚", at, [
      { transform: "translate(-50%,-50%) scale(0.4)", opacity: 0 },
      { transform: "translate(-50%,-80%) scale(1.3)", opacity: 1, offset: 0.4 },
      { transform: "translate(-50%,-140%) scale(1)", opacity: 0 },
    ], 900);
  }
  await sleep(650);
  if (item.type === "dead") {
    setDead(item.name, true); // 방 불이 꺼지고 비어버림
    sound.play("down");
  }
  await goBack();
  room.classList.remove("fx-hit", "fx-heal");
}

// =====================================================
//  선내 방송: 아침, 투표 결과 → 지도를 화면 가운데로 옮겨 재생 + 자막
// =====================================================

let playId = 0; // 다음 단계가 오면 재생 중이던 방송을 멈추기 위한 번호

function openReplay(mode) {
  replay.head.textContent = mode === "morning" ? "● REC  어젯밤 선내 기록" : "● 투표 결과";
  replay.slot.appendChild(map.el); // 같은 지도를 옮겨옴
  replay.el.classList.remove("hidden");
}

function closeReplay() {
  if (map.el.parentElement !== mapHome()) mapHome().appendChild(map.el);
  replay.el.classList.add("hidden");
  replay.sub.textContent = "";
}

// 위쪽 작은 배너는 짧은 알림(암상인 도착 등)에만 사용
function showBanner(text, tone) {
  fx.bcText.textContent = text;
  fx.broadcast.className = "broadcast show " + (tone || "");
}
function hideBanner() {
  fx.broadcast.classList.remove("show");
}
let toastTimer = null;
function toast(text) {
  if (!replay.el.classList.contains("hidden")) return; // 재생 중엔 생략
  clearTimeout(toastTimer);
  showBanner(text, "small");
  sound.play("ping");
  toastTimer = setTimeout(hideBanner, 2600);
}

// 방송 순서대로 재생: 글자만 있는 줄은 자막만, 사건은 지도 애니메이션도
// mode: "morning" | "result" / delay: 단계 타이틀 카드가 끝날 때까지 기다리는 시간(ms)
async function playSequence(sequence, mode, delay) {
  const id = ++playId;

  // 이번 발표에서 죽는 사람의 방은 애니메이션 전까지 불을 켜둠
  for (const item of sequence) {
    if (item.type === "dead" || item.type === "executed") setDead(item.name, false);
  }
  if (delay) await sleep(delay);
  if (id !== playId) return;

  openReplay(mode);
  for (const item of sequence) {
    if (id !== playId) return;
    replay.sub.textContent = item.text;
    replay.sub.className = "replay-sub " + (item.type === "healed" ? "good" : item.type ? "bad" : "");
    if (item.type) await playEvent(item);
    else await sleep(1800);
  }
  if (id !== playId) return;
  await sleep(700);
  if (id === playId) closeReplay();
}

function stopSequence() {
  playId++;
  closeReplay();
  map.el.classList.remove("alarm", "verdict");
  map.walker.className = "mwalker";
  map.hatch.className = "hatch";
  map.fx.innerHTML = "";
  hideBanner();
}

// =====================================================
//  단계 전환 타이틀 카드
//  밤 → 아침 → 독대 → 발언 → 투표로 넘어갈 때 1.2초 동안 크게 보여줌
// =====================================================
const PHASE_CARD_MS = 1300;
let cardTimer = null;

function showPhaseCard(title, sub, tone) {
  const card = document.querySelector("#phase-card");
  document.querySelector("#pc-title").textContent = title;
  document.querySelector("#pc-sub").textContent = sub || "";
  card.className = "phase-card " + (tone || "");
  card.getBoundingClientRect(); // 애니메이션 다시 시작
  card.classList.add("show");
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => card.classList.remove("show"), calm ? 600 : PHASE_CARD_MS);
}

// =====================================================
//  2. 시작 연출
// =====================================================

let introRole = null;

function setIntroRole(role) {
  introRole = role;
}

function setMyName(name) {
  myName = name;
}

function showIntro(shipName) {
  fx.shipName.textContent = shipName || "";
  fx.cardFront.innerHTML = "";
  if (introRole) {
    fx.cardFront.className = "card-front " + introRole.teamId;
    if (avatarByName[myName]) fx.cardFront.appendChild(avatarImg(avatarByName[myName], "card-avatar"));
    fx.cardFront.appendChild(el("small", null, introRole.team));
    const nm = el("strong", "role-title");
    nm.append(roleIcon(introRole.id, "big"), " " + introRole.name);
    fx.cardFront.appendChild(nm);
    fx.cardFront.appendChild(el("p", null, introRole.desc));
    if (introRole.allies.length) fx.cardFront.appendChild(el("p", "allies", "동료: " + introRole.allies.join(", ")));
    if (introRole.extra) fx.cardFront.appendChild(el("p", "allies", introRole.extra));
  }
  // 애니메이션을 처음부터 다시 재생하려고 클래스를 뺐다 넣음
  fx.intro.classList.remove("hidden", "play");
  fx.intro.getBoundingClientRect();
  fx.intro.classList.add("play");
  sound.play("intro");
  if (!calm) sound.play("flip", 5200);
}

function hideIntro() {
  fx.intro.classList.add("hidden");
  fx.intro.classList.remove("play");
}

// =====================================================
//  3. 카지노
// =====================================================

const SYMBOLS = ["7", "♠", "◆", "★", "☢", "♣"];
let spinning = false;
let spinStart = 0;
let wheelAngle = 0;
let reelTimer = null;

function startSpin(kind) {
  spinning = true;
  spinStart = Date.now();
  fx.casinoResult.className = "casino-result";
  fx.casinoResult.textContent = kind === "double" ? "룰렛이 돈다..." : "릴이 돈다...";
  fx.wheel.parentElement.classList.toggle("hidden", kind !== "double");
  fx.reels.classList.toggle("hidden", kind !== "jackpot");

  sound.spin(kind === "double" ? 2600 : 2000);
  if (kind === "double") {
    fx.wheel.style.transition = "none";
    fx.wheel.classList.add("spinning");
  } else {
    const reels = fx.reels.querySelectorAll("span");
    reelTimer = setInterval(() => {
      reels.forEach((r) => {
        if (!r.classList.contains("stopped")) r.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      });
    }, 70);
    reels.forEach((r) => r.classList.remove("stopped"));
  }
}

// 서버 결과를 받으면 최소 1.4초는 돌린 뒤 멈춤
async function stopSpin(res) {
  const wait = Math.max(0, 1400 - (Date.now() - spinStart));
  await sleep(wait);

  if (res.error) {
    fx.wheel.classList.remove("spinning");
    clearInterval(reelTimer);
    fx.casinoResult.textContent = res.error;
    sound.play("error");
    spinning = false;
    return;
  }

  if (res.kind === "double") {
    // 룰렛판: 30도마다 빨강/검정. 위쪽 바늘에 빨강이 오면 당첨
    fx.wheel.classList.remove("spinning");
    const target = res.win ? 15 : 45; // 빨강 칸 가운데 / 검정 칸 가운데
    const extra = 60 * Math.floor(Math.random() * 6);
    wheelAngle = wheelAngle - (wheelAngle % 360) + 1080 + (360 - target - extra);
    fx.wheel.style.transition = "";
    fx.wheel.style.transform = "rotate(" + wheelAngle + "deg)";
    await sleep(1300);
  } else {
    // 슬롯: 당첨이면 7 세 개, 아니면 서로 다른 그림
    const reels = [...fx.reels.querySelectorAll("span")];
    let final = res.win ? ["7", "7", "7"] : [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    if (!res.win && final[0] === final[1] && final[1] === final[2]) final[2] = final[2] === "♠" ? "◆" : "♠";
    for (let i = 0; i < 3; i++) {
      await sleep(260);
      reels[i].textContent = final[i];
      reels[i].classList.add("stopped");
      sound.play("reel");
    }
    clearInterval(reelTimer);
  }

  fx.casinoResult.textContent = res.win ? "당첨! +" + res.delta + "만" : "꽝. " + res.delta + "만";
  fx.casinoResult.className = "casino-result " + (res.win ? "win" : "lose");
  sound.play(res.win ? "win" : "lose");
  spinning = false;
}

// =====================================================
//  4. 게임 결과
// =====================================================

const TEAM_COLORS = {
  citizen: ["#2ff4ff", "#ffffff", "#7afcff"],
  syndicate: ["#ff4d6d", "#ff2fd1", "#ffffff"],
  third: ["#ffc94d", "#ffffff", "#ff9f1c"],
};

function showResult(data, isHost) {
  fx.result.dataset.winner = data.winner;
  document.querySelector("#result-me").textContent = data.won ? "승리" : "패배";
  document.querySelector("#result-me").className = "result-me " + (data.won ? "won" : "lost");
  document.querySelector("#result-headline").textContent = data.headline;
  document.querySelector("#result-reason").textContent = data.reason;
  document.querySelector("#result-note").textContent = isHost ? "" : "방장이 다음 게임을 고르는 중입니다.";

  // 승리한 사람을 위로, 팀 색과 직업 공개
  const list = document.querySelector("#result-list");
  list.innerHTML = "";
  const sorted = [...data.reveal].sort((a, b) => b.won - a.won);
  for (const r of sorted) {
    const li = el("li", r.teamId + (r.won ? " won" : "") + (r.alive ? "" : " dead"));
    const who = el("span", "who");
    who.appendChild(token(r.name, true));
    who.appendChild(document.createTextNode(" " + r.name + (r.name === myName ? " (나)" : "")));
    li.appendChild(who);
    const rl = el("strong", "result-role");
    rl.append(roleIcon(r.roleId), " " + r.role);
    li.appendChild(rl);
    list.appendChild(li);
  }

  for (const btn of ["#restart-btn", "#to-lobby-btn"]) {
    document.querySelector(btn).classList.toggle("hidden", !isHost);
  }

  // 축하 종이가루: 이긴 팀 색으로
  fx.confetti.innerHTML = "";
  fx.result.classList.toggle("lost", !data.won); // 진 사람은 종이가루 없이 어둡게
  if (!calm && data.won) {
    const colors = TEAM_COLORS[data.winner] || TEAM_COLORS.citizen;
    for (let i = 0; i < 70; i++) {
      const c = el("i");
      c.style.left = Math.random() * 100 + "%";
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 1.2 + "s";
      c.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
      c.style.setProperty("--drift", (Math.random() * 120 - 60).toFixed(0) + "px");
      fx.confetti.appendChild(c);
    }
  }
  if (fx.result.classList.contains("hidden")) sound.play(data.won ? "victory" : "defeat");
  fx.result.classList.remove("hidden");
}

function hideResult() {
  fx.result.classList.add("hidden");
  fx.confetti.innerHTML = "";
}

// =====================================================
//  5. 밀담 부스 (독대 시간)
//  나는 왼쪽, 상대는 오른쪽에 마주 앉음
//  라운드가 시작되면 부스 문이 닫혀 있다가 스르륵 열리며 상대가 드러남
// =====================================================

const boothUI = {
  el: document.querySelector("#booth"),
  title: document.querySelector("#booth-title"),
  rounds: document.querySelector("#booth-rounds"),
  sign: document.querySelector("#booth-sign"),
  me: document.querySelector("#booth-me"),
  them: document.querySelector("#booth-them"),
  badges: document.querySelector("#booth-badges"),
  leave: document.querySelector("#booth-leave"),
  closed: document.querySelector("#booth-closed"),
};
let boothKey = ""; // 같은 라운드 정보가 다시 와도 문 연출을 반복하지 않으려고
let boothDoorTimer = null;

// 의자 하나 채우기: 캐릭터 + 이름표
// kind: "player" | "masked"(???) | "empty"(대기실 빈 자리)
function fillSeat(seat, name, kind, label) {
  seat.innerHTML = "";
  seat.className = "seat " + (seat === boothUI.me ? "me" : "them") + " " + kind;
  seat.style.setProperty("--c", kind === "player" ? colorOf(name) : "#6b6b85");
  const body = el("div", "seat-body");
  if (kind === "player" && avatarByName[name]) body.appendChild(avatarImg(avatarByName[name], "seat-avatar"));
  else if (kind === "masked") {
    body.appendChild(el("span", "seat-mystery", "?"));
  } else if (kind === "empty") {
    body.appendChild(el("span", "seat-empty", "빈 자리"));
  } else {
    body.appendChild(el("span", "seat-mystery", (name || "?").charAt(0)));
  }
  seat.appendChild(body);
  seat.appendChild(el("span", "seat-name", label));
}

function showBooth(data) {
  const b = data.booth;
  if (data.phase === "talk" && !data.alive && data.spectate) return showSpectate(data);
  if (data.phase !== "talk" || !data.alive || !b) return hideBooth();
  boothUI.el.classList.remove("spectate");
  const ui = boothUI;
  ui.el.classList.remove("hidden");
  ui.el.classList.toggle("waiting", !!b.waiting);
  ui.leave.classList.toggle("hidden", !!b.waiting); // 대기실엔 끝낼 대화가 없음
  ui.title.textContent = b.waiting ? "대기실" : "밀담 부스 #" + b.no;
  ui.sign.textContent = b.waiting ? "LOUNGE" : "PRIVATE";

  // 라운드 점: ● 지난/지금, ○ 남은
  ui.rounds.innerHTML = "";
  for (let i = 1; i <= (data.total || 1); i++) {
    ui.rounds.appendChild(el("i", i < data.round ? "done" : i === data.round ? "now" : ""));
  }
  ui.rounds.setAttribute("aria-label", "라운드 " + data.round + " / " + data.total);

  fillSeat(ui.me, myName, "player", b.masked ? "나 (???로 보임)" : "나");
  if (b.waiting) fillSeat(ui.them, null, "empty", "다음 라운드를 기다리는 중");
  else if (data.partner === "???") fillSeat(ui.them, null, "masked", "???");
  else fillSeat(ui.them, data.partner, "player", data.partner);
  ui.el.classList.toggle("jammed", !!b.jammed);

  // 배지: 이번 라운드에 걸린 특별한 상태
  ui.badges.innerHTML = "";
  const badge = (cls, text) => ui.badges.appendChild(el("span", "bbadge " + cls, text));
  if (b.hosted) badge("hosted", "🤝 방장이 주선한 만남");
  if (b.masked) badge("masked", "🎭 상대에게 ???로 보임");
  if (b.jammed) badge("jammed", "📵 재밍: 이번 라운드는 말할 수 없음");
  if (b.wiretap) badge("tap", "🎧 도청 중: " + b.wiretap);
  if (b.waiting) addCasinoShortcut();

  // 라운드가 바뀔 때만 문 연출 (타이틀 카드가 걷힐 즈음 문이 열림)
  const key = data.day + ":" + data.round;
  if (key !== boothKey) {
    boothKey = key;
    ui.el.classList.remove("open", "ended");
    resetLeaveBtn();
    ui.me.querySelector(".bubble")?.remove();
    ui.them.querySelector(".bubble")?.remove();
    clearTimeout(boothDoorTimer);
    boothDoorTimer = setTimeout(() => {
      ui.el.classList.add("open");
      sound.play("door");
    }, calm ? 0 : PHASE_CARD_MS * 0.7);
  }
}

// 대화 종료: 문이 다시 닫히고 "CLOSED" 안내
function endBooth(text) {
  const ui = boothUI;
  ui.el.classList.remove("open");
  ui.el.classList.add("ended");
  ui.leave.classList.add("hidden");
  ui.closed.innerHTML = "";
  ui.closed.appendChild(el("strong", null, "CLOSED"));
  ui.closed.appendChild(el("span", null, text));
  if (ui.el.classList.contains("spectate")) {
    ui.closed.appendChild(el("small", null, "다른 부스를 골라 볼 수 있어요"));
    return;
  }
  ui.closed.appendChild(el("small", null, "남은 시간은 카지노에서 보낼 수 있어요"));
  addCasinoShortcut();
}

// 대기실·대화 종료 때: 카지노로 바로 가는 버튼
function addCasinoShortcut() {
  if (boothUI.badges.querySelector(".go-casino")) return;
  const b = el("button", "bbadge go-casino", "🎰 카지노 열기 · 도박 · 채굴");
  b.type = "button";
  boothUI.badges.appendChild(b);
}

// 대화 종료 버튼: 실수로 누르지 않게 두 번 눌러야 함
let leaveTimer = null;
function resetLeaveBtn() {
  clearTimeout(leaveTimer);
  boothUI.leave.classList.remove("confirm");
  boothUI.leave.textContent = "대화 종료";
}
function pressLeaveBtn() {
  const btn = boothUI.leave;
  if (!btn.classList.contains("confirm")) {
    btn.classList.add("confirm");
    btn.textContent = "정말 끝낼까요?";
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(resetLeaveBtn, 3000);
    return false;
  }
  resetLeaveBtn();
  return true; // 두 번째 클릭: 진짜 종료
}

// =====================================================
//  사망자 관전: 부스를 골라 대화 엿보기
// =====================================================
let spectating = null; // { no, names }

function showSpectate(data) {
  const ui = boothUI;
  spectating = null;
  ui.el.classList.remove("hidden", "waiting", "jammed", "ended");
  ui.el.classList.add("spectate", "open");
  ui.leave.classList.add("hidden");
  ui.title.textContent = "관전 · 부스를 고르세요";
  ui.sign.textContent = "GHOST CAM";
  ui.rounds.innerHTML = "";
  for (let i = 1; i <= (data.total || 1); i++) ui.rounds.appendChild(el("i", i < data.round ? "done" : i === data.round ? "now" : ""));
  fillSeat(ui.me, null, "empty", "");
  fillSeat(ui.them, null, "empty", "");
  ui.closed.innerHTML = "";
  ui.badges.innerHTML = "";
  if (!data.spectate.length) ui.badges.appendChild(el("span", "bbadge", "이번 라운드엔 열린 부스가 없어요"));
  for (const bth of data.spectate) {
    const btn = el("button", "bbadge spec-pick", "👁 부스 #" + bth.no + " · " + bth.names.join(" ↔ "));
    btn.type = "button";
    btn.dataset.no = bth.no;
    ui.badges.appendChild(btn);
  }
}

// 고른 부스의 두 사람을 앉히고, 지난 대화를 말풍선 없이 채팅 칸에 쌓음
function enterSpectate(info) {
  const ui = boothUI;
  spectating = { no: info.no, names: info.names };
  ui.title.textContent = "관전 · 밀담 부스 #" + info.no;
  ui.el.classList.toggle("ended", !!info.ended);
  fillSeat(ui.me, info.names[0], "player", info.names[0]);
  fillSeat(ui.them, info.names[1], "player", info.names[1]);
  for (const b of ui.badges.querySelectorAll(".spec-pick")) b.classList.toggle("on", Number(b.dataset.no) === info.no);
  if (info.ended) {
    ui.closed.innerHTML = "";
    ui.closed.appendChild(el("strong", null, "CLOSED"));
    ui.closed.appendChild(el("span", null, "이 부스는 대화가 끝났습니다"));
  }
}

// 관전 중 말풍선: 이름으로 왼쪽/오른쪽 자리를 찾음
function spectateSay(from, text) {
  if (!spectating) return;
  boothSay(from === spectating.names[0], text);
}

function hideBooth() {
  spectating = null;
  boothUI.el.classList.remove("spectate");
  boothUI.el.classList.add("hidden");
  boothUI.el.classList.remove("open");
  boothKey = "";
}

// 말풍선: 말한 사람 머리 위에 잠깐 띄움
function boothSay(mine, text) {
  if (boothUI.el.classList.contains("hidden")) return;
  const seat = mine ? boothUI.me : boothUI.them;
  seat.querySelector(".bubble")?.remove();
  const bubble = el("span", "bubble", text.length > 46 ? text.slice(0, 45) + "…" : text);
  seat.appendChild(bubble);
  seat.classList.remove("talking");
  seat.getBoundingClientRect();
  seat.classList.add("talking");
  setTimeout(() => bubble.remove(), 4200);
}
