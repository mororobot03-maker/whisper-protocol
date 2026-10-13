// =====================================================
//  위스퍼 프로토콜 - 브라우저
// =====================================================
const socket = io(); // 서버와 연결

// 화면 요소 가져오기
const screens = {
  join: document.querySelector("#join-screen"),
  lobby: document.querySelector("#lobby-screen"),
  game: document.querySelector("#game-screen"),
};
const codeInput = document.querySelector("#code-input");
const nameInput = document.querySelector("#name-input");
const joinBtn = document.querySelector("#join-btn");

const lobbyCode = document.querySelector("#lobby-code");
const playerCount = document.querySelector("#player-count");
const playerList = document.querySelector("#player-list");
const optionList = document.querySelector("#option-list");
const roleSummary = document.querySelector("#role-summary");
const roleList = document.querySelector("#role-list");
const checkErrors = document.querySelector("#check-errors");
const startBtn = document.querySelector("#start-btn");
const lobbyNote = document.querySelector("#lobby-note");

const dayLabel = document.querySelector("#day-label");
const phaseLabel = document.querySelector("#phase-label");
const timerEl = document.querySelector("#timer");
const roleCard = document.querySelector("#role-card");
const phaseInfo = document.querySelector("#phase-info");
const votePanel = document.querySelector("#vote-panel");
const chatLog = document.querySelector("#chat-log");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const sendBtn = document.querySelector("#send-btn");
const hpBox = document.querySelector("#hp");
const creditBox = document.querySelector("#credits");
const creditNum = document.querySelector("#credit-num");
const creditDelta = document.querySelector("#credit-delta");
const phaseIcon = document.querySelector("#phase-icon");
const privateBox = document.querySelector("#private-box");
const actionPanel = document.querySelector("#action-panel");
const actionLabel = document.querySelector("#action-label");
const actionNote = document.querySelector("#action-note");
const actionModes = document.querySelector("#action-modes");
const actionTarget = document.querySelector("#action-target");
const actionTarget2 = document.querySelector("#action-target2");
const actionBtn = document.querySelector("#action-btn");
const actionChosen = document.querySelector("#action-chosen");
const actionPick = document.querySelector("#action-pick");
const timerFill = document.querySelector("#timer-fill");
const meRole = document.querySelector("#me-role");
const intelLog = document.querySelector("#intel-log");
const tabs = document.querySelector("#tabs");
const darknetList = document.querySelector("#darknet-list");
const transferBtn = document.querySelector("#transfer-btn");
const errorEl = document.querySelector("#error");

let countdown = null; // 남은 시간 표시용 타이머
let currentDay = 0;

// 화면 하나만 보이게 하기
function show(name) {
  for (const key in screens) {
    screens[key].classList.toggle("hidden", key !== name);
  }
  errorEl.textContent = "";
}

// 태그 하나 만들기 (textContent라서 HTML 코드를 넣어도 실행되지 않음)
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// 채팅 로그에 한 줄 추가
// content: 글자 또는 미리 만든 요소(토큰이 들어간 채팅 줄)
function addLine(content, type) {
  const li = make("li", type);
  if (typeof content === "string") li.textContent = content;
  else li.appendChild(content);
  chatLog.appendChild(li);
  chatLog.scrollTop = chatLog.scrollHeight;
  // 채팅이 안 보일 때 새 메시지가 오면 탭에 빨간 점 (단계 구분선은 제외)
  if (type !== "divider" && !isVisible("chat")) setDot("chat", true);
}

// 남은 시간: 숫자 + 줄어드는 바 (실제 단계 전환은 서버가 결정)
function startTimer(seconds) {
  clearInterval(countdown);
  timerEl.classList.remove("urgent");
  if (!seconds) {
    timerEl.textContent = "";
    timerFill.style.width = "0%";
    return;
  }
  let left = seconds;
  const draw = () => {
    timerEl.textContent = Math.max(left, 0) + "초";
    timerFill.style.width = (Math.max(left, 0) / seconds) * 100 + "%";
    timerEl.classList.toggle("urgent", left <= 5); // 마지막 5초는 빨갛게
  };
  draw();
  countdown = setInterval(() => {
    left--;
    draw();
    if (left > 0 && left <= 5) sound.play(left <= 3 ? "tickLast" : "tick"); // 마지막 5초 째깍
    if (left <= 0) clearInterval(countdown);
  }, 1000);
}

// =====================================================
//  탭
// =====================================================

// PC처럼 넓은 화면에서는 채팅이 항상 왼쪽에 보임
const wide = window.matchMedia("(min-width: 900px)");
let currentTab = "chat";

function isVisible(name) {
  return currentTab === name || (name === "chat" && wide.matches);
}

function setDot(name, on) {
  const dot = tabs.querySelector('[data-tab="' + name + '"] .dot');
  if (dot) dot.classList.toggle("on", on);
}

// 앱 여는 연출: 이번 단계에서 처음 열면 0.4초짜리 앱 고유 연출, 다시 열면 0.15초로 빠르게
// silent: 단계가 바뀌면서 자동으로 여는 경우 (타이틀 카드와 겹치지 않게 연출 생략)
const openedApps = new Set();
let appTimer = null;

function setTab(name, silent) {
  // 넓은 화면에서 채팅 탭을 고르면 오른쪽은 "내 정보"를 보여줌
  if (name === "chat" && wide.matches) name = "info";
  const changed = currentTab !== name;
  currentTab = name;
  updateMusic(); // 낮에 카지노 탭을 열면 카지노 음악
  for (const btn of tabs.querySelectorAll("button")) btn.classList.toggle("active", btn.dataset.tab === name);
  for (const pane of document.querySelectorAll(".pane")) {
    const on = pane.dataset.pane === name;
    pane.classList.toggle("active", on);
    pane.classList.remove("enter-first", "enter-quick");
    if (on && changed && !silent && pane.classList.contains("app")) {
      const first = !openedApps.has(name);
      pane.classList.add(first ? "enter-first" : "enter-quick");
      clearTimeout(appTimer);
      appTimer = setTimeout(() => pane.classList.remove("enter-first", "enter-quick"), 500);
      if (first && name === "darknet") bootTerminal();
    }
  }
  if (!silent) openedApps.add(name);
  setDot(name, false);
  if (name === "chat") chatLog.scrollTop = chatLog.scrollHeight;
  if (name === "dm" && dm.open) {
    dm.unread[dm.open] = 0;
    drawDM();
  }
}

// 단계마다 보여줄 탭과 처음 열 탭
// 낮: 그룹 채팅 · 카지노 · 송금 / 밤: 능력 · 메신저 · 암상인 · 다크넷 · 송금 / 투표: 투표
function setupTabs(data) {
  const night = data.phase === "night" && data.alive;
  const day = data.phase === "day" && data.alive;
  const show = {
    chat: true,
    dm: data.phase === "night", // 사망자도 관전용으로 열림
    info: true,
    action: night,
    auction: data.phase === "night", // 사망자도 구경은 가능
    darknet: night,
    bank: night || day,
    casino: day,
    vote: !!data.canVote,
    memo: true,
    log: true,
    dex: true,
  };
  for (const btn of tabs.querySelectorAll("button")) btn.classList.toggle("hidden", !show[btn.dataset.tab]);
  document.querySelector("#chat-tab-label").textContent = data.phase === "day" ? "그룹 채팅" : "채팅";

  openedApps.clear(); // 새 단계: 앱을 처음 열 때 연출이 다시 나옴
  if (night) setTab("action", true);
  else if (data.phase === "night") setTab("dm", true); // 사망자: 메신저 관전
  else if (data.canVote) setTab("vote", true);
  else if (day && wide.matches) setTab("casino", true); // PC: 왼쪽 그룹 채팅 + 오른쪽 카지노
  else setTab("chat", true);
}

tabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.tab !== currentTab) sound.play("tab");
  setTab(btn.dataset.tab);
});
wide.addEventListener("change", () => setTab(currentTab));

// =====================================================
//  로비 그리기
// =====================================================

// 게임 규칙 (드롭다운)
function drawOptions(options, settings, isHost) {
  optionList.innerHTML = "";
  for (const key in options) {
    const opt = options[key];
    const label = make("label", "option");
    label.appendChild(make("span", null, opt.label));

    const select = make("select");
    select.dataset.key = key;
    select.disabled = !isHost;
    opt.values.forEach((v) => {
      const text = opt.labels ? opt.labels[v] : v === "auto" ? "자동" : v + opt.unit;
      const o = make("option", null, text);
      o.value = v;
      if (String(v) === String(settings[key])) o.selected = true;
      select.appendChild(o);
    });

    label.appendChild(select);
    optionList.appendChild(label);
  }
}

// 직업 구성: 팀별 목록. 방장은 눌러서 금지 / 금지 해제
// 실제로 누가 무슨 직업인지는 게임이 시작될 때 랜덤으로 정해짐
function drawRoles(catalog, settings, check, isHost) {
  roleList.innerHTML = "";
  const pool = new Set(check.pool);
  const head = make("p", "ban-help", isHost ? "눌러서 이번 판에 나오지 않게 금지할 수 있어요. 남은 직업 중에서 랜덤으로 정해집니다." : "방장이 금지한 직업은 나오지 않아요. 남은 직업 중에서 랜덤으로 정해집니다.");
  roleList.appendChild(head);

  for (const teamId in catalog.teams) {
    const group = make("div", "role-group " + teamId);
    group.appendChild(make("h3", null, catalog.teams[teamId]));
    const grid = make("div", "ban-grid");
    for (const id in catalog.roles) {
      const role = catalog.roles[id];
      if (role.team !== teamId) continue;
      const banned = settings.bans.includes(id);
      const locked = !role.noBan && !banned && !pool.has(id); // 인원이 부족해서 못 나옴 (밀항자 7인 이상 등)
      const btn = make("button", "ban-card" + (banned ? " banned" : "") + (role.noBan ? " fixed" : "") + (locked ? " locked" : ""));
      btn.type = "button";
      btn.dataset.id = id;
      btn.disabled = !isHost || !!role.noBan;
      const nm = make("strong");
      nm.append(roleIcon(id), " " + role.name);
      btn.appendChild(nm);
      btn.appendChild(make("small", null, role.desc));
      const tag = role.noBan ? (id === "vip" ? "필수" : "기본") : banned ? "금지" : locked ? (role.minPlayers || 7) + "인 이상" : ""; // 제3세력은 7인부터
      if (tag) btn.appendChild(make("em", "ban-tag", tag));
      grid.appendChild(btn);
    }
    group.appendChild(grid);
    roleList.appendChild(group);
  }
}

// =====================================================
//  게임 화면 그리기
// =====================================================

// 나만 보는 밤 결과 (아침에)
function drawPrivate(lines) {
  privateBox.innerHTML = "";
  const has = lines && lines.length > 0;
  privateBox.classList.toggle("hidden", !has);
  if (!has) return;
  privateBox.appendChild(make("small", null, "나만 보는 결과"));
  lines.forEach((line) => privateBox.appendChild(make("p", null, line)));
}

// 드롭다운에 이름 채우기
function fillSelect(select, names) {
  select.innerHTML = "";
  names.forEach((name) => {
    const o = make("option", null, name);
    o.value = name;
    select.appendChild(o);
  });
}

// 밤 행동 패널
// =====================================================
//  밤 능력: 복도의 객실을 눌러서 대상 지정
//  (드롭다운은 숨겨두고 값만 저장하는 용도로 씀)
// =====================================================
const targeting = { active: false, pair: false, candidates: new Set(), picks: [], locked: [] };

// 복도 객실에 "고를 수 있음 / 고름 / 확정" 표시 입히기
function refreshTargeting() {
  document.querySelector("#deck").classList.toggle("targeting", targeting.active);
  document.querySelector("#shipmap").classList.toggle("targeting", targeting.active);
  for (const room of document.querySelectorAll("#rooms .room, #mrooms .mroom")) {
    const name = room.dataset.name;
    room.classList.toggle("targetable", targeting.active && targeting.candidates.has(name));
    room.classList.toggle("picked", targeting.active && targeting.picks.includes(name));
    room.classList.toggle("locked", targeting.active && targeting.locked.includes(name));
    room.tabIndex = targeting.active && targeting.candidates.has(name) ? 0 : -1;
  }
}

// 지금 고른 대상을 패널에 보여주고, 숨은 드롭다운에도 값 넣기
function showPicks() {
  actionPick.innerHTML = "";
  const need = targeting.pair ? 2 : 1;
  if (targeting.picks.length === 0) {
    actionPick.textContent = targeting.pair ? "복도에서 두 사람을 누르세요" : "복도에서 대상을 누르세요";
  } else {
    actionPick.appendChild(make("span", null, "대상: "));
    targeting.picks.forEach((name, i) => {
      if (i > 0) actionPick.appendChild(make("span", null, " ↔ "));
      actionPick.appendChild(nameTag(name));
    });
  }
  actionTarget.value = targeting.picks[0] || "";
  actionTarget2.value = targeting.picks[1] || "";
  actionBtn.disabled = targeting.picks.length < need;
}

function stopTargeting() {
  targeting.active = false;
  targeting.picks = [];
  targeting.locked = [];
  refreshTargeting();
}

function drawAction(action) {
  actionChosen.textContent = "";
  if (!action || action.reason) stopTargeting();
  if (!action) return;

  // 행동할 수 없는 경우: 이유만 보여줌
  const can = !action.reason;
  actionLabel.textContent = can ? action.label : action.reason;
  actionNote.textContent = action.note || "";
  actionPick.classList.toggle("hidden", !can);
  actionBtn.classList.toggle("hidden", !can);
  actionModes.innerHTML = "";
  if (!can) return;

  fillSelect(actionTarget, action.candidates);
  fillSelect(actionTarget2, action.candidates);
  targeting.active = true;
  targeting.pair = !!action.pair;
  targeting.candidates = new Set(action.candidates);
  targeting.picks = action.candidates.length === 1 ? [action.candidates[0]] : []; // 고를 사람이 1명뿐이면 자동 선택
  targeting.locked = [];
  showPicks();
  refreshTargeting();

  // 신디케이트처럼 행동 종류를 고르는 직업 (공격 투표 / 특수 능력)
  if (action.modes) {
    let first = true;
    currentAction = action;
    for (const key in action.modes) {
      const label = make("label", "mode");
      const radio = make("input");
      radio.type = "radio";
      radio.name = "mode";
      radio.value = key;
      radio.checked = first;
      first = false;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(" " + action.modes[key]));
      actionModes.appendChild(label);
    }
    applyModeCandidates();
  }
}

// 고른 행동 종류에 맞게 "고를 수 있는 사람"을 바꿈 (예: 독 투여는 동료 제외)
let currentAction = null;
function applyModeCandidates() {
  const a = currentAction;
  if (!a || !a.modeCandidates) return;
  const mode = actionModes.querySelector("input:checked")?.value;
  const list = a.modeCandidates[mode] || a.candidates;
  targeting.candidates = new Set(list);
  targeting.picks = targeting.picks.filter((n) => targeting.candidates.has(n));
  fillSelect(actionTarget, list);
  showPicks();
  refreshTargeting();
}
actionModes.addEventListener("change", applyModeCandidates);

// 객실 누르기
function onRoomClick(e) {
  const room = e.target.closest(".room, .mroom");
  if (room && stage.mode === "vote" && stage.votable.has(room.dataset.name)) {
    sound.play("click");
    return socket.emit("vote", room.dataset.name); // 원형 지도(또는 복도)에서 바로 투표
  }
  if (!room || !targeting.active) return;
  const name = room.dataset.name;
  if (!targeting.candidates.has(name)) return;

  if (targeting.pair) {
    // 두 명 고르기: 다시 누르면 취소, 세 번째를 누르면 가장 먼저 고른 사람이 빠짐
    if (targeting.picks.includes(name)) targeting.picks = targeting.picks.filter((n) => n !== name);
    else targeting.picks = [...targeting.picks, name].slice(-2);
  } else {
    targeting.picks = [name];
  }
  showPicks();
  refreshTargeting();
  if (!isVisible("action")) setTab("action"); // 다른 탭을 보고 있었으면 능력 탭으로
}
// 위쪽 띠의 객실과 선내 지도의 방, 어느 쪽을 눌러도 대상 지정
document.querySelector("#rooms").addEventListener("click", onRoomClick);
document.querySelector("#mrooms").addEventListener("click", onRoomClick);

// =====================================================
//  밤 경제 그리기
// =====================================================

let lastEco = null; // 가장 최근 경제 정보 (다시 그리기용)
let myCredits = 0;

// 아이템 효과 시점 (화면 표시용)
const WHEN_LABEL = { now: "즉시 · 오늘 밤", tonight: "오늘 밤", morning: "아침에 결과", tomorrow: "내일 투표", multi: "3일 동안" };
const CAT_LABEL = { hack: "해킹", defense: "방어", info: "정보·기타" };

// 대상을 고르는 작은 얼굴 목록 (경매 낙찰품, 다크넷 공용)
// picker = { kind: "svc", id } : 다크넷에서 지금 열려 있는 선택 칸
let picker = null;

function peoplePicker(names, onPick) {
  const row = make("div", "pick-row");
  for (const name of names) {
    const b = make("button", "pick");
    b.type = "button";
    b.dataset.pick = name;
    b.appendChild(nameTag(name, true));
    row.appendChild(b);
  }
  row.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (b) onPick(b.dataset.pick);
  });
  return row;
}

// =====================================================
//  경매장
//  서버가 보내는 상태(auction)를 그대로 그림. 남은 시간만 화면에서 줄여 감
// =====================================================
const aucEl = {
  img: document.querySelector("#auctioneer"),
  bubble: document.querySelector("#auc-bubble"),
  say: document.querySelector("#auc-say"),
  call: document.querySelector("#auc-call"),
  track: document.querySelector("#auc-track"),
  lot: document.querySelector("#auc-lot"),
  min: document.querySelector("#bid-min"),
  plus: document.querySelector("#bid-plus"),
  input: document.querySelector("#bid-input"),
  custom: document.querySelector("#bid-custom-btn"),
  note: document.querySelector("#auc-note"),
  inv: document.querySelector("#inventory"),
};
let auc = null; // 가장 최근 경매 상태
let aucAt = 0; // 그 상태를 받은 시각 (남은 시간 계산용)
let aucMood = "default";
let moodTimer = null;
let aucTick = null;
let canBid = false; // 살아있고 밤일 때만

function setMood(mood, ms) {
  clearTimeout(moodTimer);
  if (aucMood !== mood) {
    aucMood = mood;
    aucEl.img.src = "img/auctioneer/auctioneer_" + mood + ".png";
    aucEl.img.classList.remove("pop");
    aucEl.img.getBoundingClientRect();
    aucEl.img.classList.add("pop");
  }
  if (ms) moodTimer = setTimeout(() => { moodTimer = null; setMood("default"); }, ms);
}

// 경매사 말: 물건 소개는 말풍선 본문, 입찰 호가는 아래 한 줄 (소개가 지워지지 않게)
function say(text) {
  aucEl.say.textContent = text;
  aucEl.call.textContent = "";
  aucEl.bubble.classList.remove("pop");
  aucEl.bubble.getBoundingClientRect();
  aucEl.bubble.classList.add("pop");
}

function liveLot() {
  return auc && auc.index >= 0 && auc.lots[auc.index] && auc.lots[auc.index].status === "live" ? auc.lots[auc.index] : null;
}

function lotLeft(lot) {
  return Math.max(0, lot.left - (Date.now() - aucAt));
}

function minBid(lot) {
  return lot.leader ? lot.price + lot.step : lot.start;
}

function drawAuction() {
  if (!auc) return;
  // 진행 표시: 5칸
  aucEl.track.innerHTML = "";
  auc.lots.forEach((lot, i) => {
    const cell = make("div", "auc-slot " + lot.status + (lot.mine && lot.status === "sold" ? " won" : ""));
    cell.title = lot.name;
    cell.appendChild(icon(lot.id));
    cell.appendChild(make("small", null, lot.status === "sold" ? lot.price + "만" : lot.status === "unsold" ? "유찰" : lot.status === "live" ? "진행 중" : i + 1 + "번"));
    aucEl.track.appendChild(cell);
  });

  // 지금 경매 중인 물건 (없으면 다음 물건 / 끝)
  const lot = liveLot();
  aucEl.lot.innerHTML = "";
  aucEl.lot.className = "auc-lot" + (lot ? " live " + lot.cat : "");
  if (lot) {
    const head = make("div", "lot-head");
    head.appendChild(icon(lot.id, "lot-ico"));
    const title = make("div", "lot-title");
    title.appendChild(make("span", "lot-cat " + lot.cat, CAT_LABEL[lot.cat] + " · " + WHEN_LABEL[lot.when]));
    title.appendChild(make("strong", null, lot.name));
    head.appendChild(title);
    aucEl.lot.appendChild(head);
    aucEl.lot.appendChild(make("p", "lot-desc", lot.desc));
    const price = make("div", "lot-price");
    const num = make("span", "lot-num");
    num.appendChild(icon("credit"));
    num.appendChild(document.createTextNode(" " + lot.price + "만"));
    price.appendChild(num);
    price.appendChild(make("span", "lot-leader" + (lot.mine ? " mine" : ""), lot.mine ? "내가 최고가!" : lot.leader ? lot.leader + " 최고가" : "시작가 · 아직 입찰 없음"));
    aucEl.lot.appendChild(price);
    const bar = make("div", "lot-timer");
    bar.appendChild(make("i", null));
    bar.appendChild(make("span", "lot-sec"));
    aucEl.lot.appendChild(bar);
  } else {
    const done = auc.index >= auc.lots.length;
    aucEl.lot.appendChild(make("p", "lot-wait", done ? "오늘 밤 경매가 모두 끝났습니다." : auc.index < 0 ? "곧 첫 번째 물건이 올라옵니다." : "다음 물건 준비 중..."));
  }

  // 입찰 버튼
  const full = auc.myWins >= auc.winLimit;
  const enable = (btn, amount, label) => {
    btn.textContent = label;
    btn.dataset.amount = amount;
    btn.disabled = !canBid || !lot || lot.mine || full || amount > myCredits;
  };
  if (lot) {
    const m = minBid(lot);
    enable(aucEl.min, m, (lot.leader ? "입찰 " : "시작가 입찰 ") + m + "만");
    enable(aucEl.plus, m + lot.step * 2, "크게 올리기 " + (m + lot.step * 2) + "만");
    aucEl.input.min = m;
    aucEl.input.placeholder = m + "만 이상";
  } else {
    enable(aucEl.min, 0, "입찰");
    enable(aucEl.plus, 0, "크게 입찰");
    aucEl.input.placeholder = "직접 입력";
  }
  aucEl.custom.disabled = aucEl.min.disabled;
  aucEl.input.disabled = aucEl.min.disabled;

  aucEl.note.textContent = !canBid
    ? "관전 중에는 입찰할 수 없어요."
    : "오늘 밤 낙찰 " + auc.myWins + " / " + auc.winLimit + "건" + (full ? " · 한도를 채웠어요" : "") + " · 보유 " + myCredits + "만 · 누가 샀는지는 공개되지 않아요";
  tickAuction();
}

// 남은 시간 막대 + 마감 직전이면 경매사가 긴장한 표정
function tickAuction() {
  const lot = liveLot();
  const bar = aucEl.lot.querySelector(".lot-timer i");
  if (!lot || !bar) return;
  const left = lotLeft(lot);
  bar.style.width = (left / (auc.lotSeconds * 1000)) * 100 + "%";
  aucEl.lot.querySelector(".lot-sec").textContent = Math.ceil(left / 1000) + "초";
  aucEl.lot.classList.toggle("ending", left <= 5000);
  if (!moodTimer) setMood(left <= 5000 && lot.leader ? "tense" : "default");
}
clearInterval(aucTick);
aucTick = setInterval(tickAuction, 200);

socket.on("auction", (a) => {
  const prev = auc;
  auc = a;
  aucAt = Date.now();
  const lot = a.lots[a.index];
  // 경매사 대사 + 소리
  if (a.event === "lot" && lot) {
    say((a.index + 1) + "번째 물건, '" + lot.name + "'! " + lot.pitch + " " + lot.desc + ". 시작가 " + lot.start + "만!");
    setMood("default");
    sound.play("flip");
    if (!isVisible("auction")) setDot("auction", true);
  } else if (a.event === "bid" && lot) {
    aucEl.call.textContent = "🔨 " + lot.price + "만! " + (lot.mine ? "당신이 최고가입니다." : lot.leader + " 님이 올렸습니다. 더 없습니까?");
    sound.play(lot.mine ? "coin" : "bid");
  } else if (a.event === "sold" && lot) {
    say("낙찰! '" + lot.name + "', " + lot.price + "만에 " + (lot.mine ? "당신께" : lot.leader + " 님께") + " 돌아갑니다!");
    setMood("sold", 2500);
    sound.play("gavel");
    toast("경매 낙찰 · " + lot.name + " (" + lot.price + "만)");
  } else if (a.event === "unsold" && lot) {
    say("'" + lot.name + "'은(는) 유찰입니다. 다음 물건으로 넘어가죠.");
  } else if (a.event === "done") {
    say("오늘 밤 경매는 여기까지입니다. 좋은 밤 되십시오.");
  } else if (!prev || a.index < 0) {
    say("곧 오늘 밤의 경매를 시작합니다. 낙찰은 한 분당 " + a.winLimit + "건까지!");
    setMood("default");
  }
  drawAuction();
});

function sendBid(amount) {
  const lot = liveLot();
  if (!lot || !amount) return;
  socket.emit("bid", { index: auc.index, amount: Number(amount) });
}
aucEl.min.addEventListener("click", () => sendBid(aucEl.min.dataset.amount));
aucEl.plus.addEventListener("click", () => sendBid(aucEl.plus.dataset.amount));
aucEl.custom.addEventListener("click", () => {
  sendBid(Math.floor(Number(aucEl.input.value)));
  aucEl.input.value = "";
});
aucEl.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") aucEl.custom.click();
});

// ----- 내 낙찰품: 대상이 필요한 물건 사용 -----
let inventory = [];
let invPick = null; // { uid, target, to, kind } 고르는 중인 값

socket.on("inventory", (list) => {
  inventory = list;
  if (invPick && !list.some((it) => it.uid === invPick.uid)) invPick = null;
  drawInventory();
});

function drawInventory() {
  aucEl.inv.innerHTML = "";
  if (!inventory.length) {
    aucEl.inv.appendChild(make("p", "inv-empty", "아직 없음 · 대상이 필요 없는 물건은 낙찰 즉시 적용돼요"));
    return;
  }
  const eco = lastEco || { players: [], everyone: [], deepfakeTemplates: {} };
  for (const it of inventory) {
    const card = make("div", "inv-card");
    const head = make("div", "inv-head");
    head.appendChild(icon(it.id, "inv-ico"));
    head.appendChild(make("strong", null, it.name));
    card.appendChild(head);
    card.appendChild(make("small", "inv-desc", it.desc));
    const pick = invPick && invPick.uid === it.uid ? invPick : null;
    const step = (label) => card.appendChild(make("small", "pick-label", label));

    if (it.target === "player") {
      step("대상 선택");
      card.appendChild(peoplePicker(eco.players, (name) => socket.emit("useItem", { uid: it.uid, target: name })));
    } else if (it.target === "deepfake") {
      if (!pick || !pick.kind) {
        step("가짜 발표 문구");
        const row = make("div", "pick-row");
        for (const k in eco.deepfakeTemplates) {
          const b = make("button", "pick", eco.deepfakeTemplates[k]);
          b.type = "button";
          b.addEventListener("click", () => { invPick = { uid: it.uid, kind: k }; drawInventory(); });
          row.appendChild(b);
        }
        card.appendChild(row);
      } else {
        step("누구 이름으로?");
        card.appendChild(peoplePicker(eco.everyone, (name) => socket.emit("useItem", { uid: it.uid, kind: pick.kind, target: name })));
      }
    } else if (it.target === "forge") {
      if (!pick || !pick.target) {
        step("① 누구인 척 보낼까?");
        card.appendChild(peoplePicker(eco.players, (name) => { invPick = { uid: it.uid, target: name }; drawInventory(); }));
      } else if (!pick.to) {
        step("② " + pick.target + " 이름으로 누구에게?");
        card.appendChild(peoplePicker(eco.everyone.filter((n) => n !== pick.target), (name) => { invPick = { ...pick, to: name }; drawInventory(); }));
      } else {
        step("③ " + pick.target + " → " + pick.to + " · 보낼 문장");
        card.appendChild(textSender(it.uid, (text) => socket.emit("useItem", { uid: it.uid, target: pick.target, to: pick.to, text })));
      }
    } else if (it.target === "text") {
      step("내일 아침 방송할 문장 (익명)");
      card.appendChild(textSender(it.uid, (text) => socket.emit("useItem", { uid: it.uid, text })));
    }
    aucEl.inv.appendChild(card);
  }
}

// 문장 입력칸 + 보내기 버튼
function textSender(uid, onSend) {
  const form = make("form", "inv-text");
  const input = make("input");
  input.maxLength = 80;
  input.placeholder = "80자까지";
  const btn = make("button", "primary", "보내기");
  btn.type = "submit";
  form.append(input, btn);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) onSend(text);
  });
  return form;
}

// ----- 다크넷: 터미널 -----
const termLog = document.querySelector("#term-log");

function termLine(text) {
  termLog.textContent += text + "\n";
  const lines = termLog.textContent.split("\n");
  if (lines.length > 7) termLog.textContent = lines.slice(-7).join("\n"); // 최근 줄만
}

function bootTerminal() {
  termLog.textContent = "";
  const lines = ["> connect leviathan.onion", "  ...암호화 터널 연결", "  접속 승인. 익명 세션 시작"];
  lines.forEach((line, i) => setTimeout(() => termLine(line), 90 * i));
}

function drawDarknet(eco) {
  darknetList.innerHTML = "";
  document.querySelector("#svc-left").textContent = "오늘 밤 남은 의뢰 " + eco.svcLeft + " / " + eco.svcLimit + "건 · 한 번 쓴 서비스는 다음부터 1.5배";
  for (const s of eco.services) {
    const card = make("div", "svc" + (s.lock ? " locked" : ""));
    card.appendChild(icon(s.id, "svc-ico"));
    const body = make("div", "svc-body");
    body.appendChild(make("strong", null, s.name.replace("인포브로커 · ", "")));
    body.appendChild(make("small", null, s.desc));
    if (s.uses) body.appendChild(make("small", "svc-uses", s.uses + "회 이용 · 가격 상승 중"));
    card.appendChild(body);

    const side = make("div", "svc-side");
    const price = make("span", "price");
    price.appendChild(icon("credit"));
    price.appendChild(document.createTextNode(s.price));
    side.appendChild(price);
    const btn = make("button", "run");
    btn.type = "button";
    btn.dataset.service = s.id;
    if (s.lock) {
      btn.appendChild(icon("lock"));
      btn.appendChild(document.createTextNode(s.lock));
    } else {
      btn.textContent = "실행";
    }
    btn.disabled = !!s.lock || eco.svcLeft <= 0 || eco.available < s.price;
    side.appendChild(btn);
    card.appendChild(side);

    if (picker && picker.kind === "svc" && picker.id === s.id) {
      card.classList.add("picking");
      card.appendChild(peoplePicker(eco.players, (name) => runService(s.id, name)));
    }
    darknetList.appendChild(card);
  }
}

function runService(id, target) {
  const cmd = { track: "trace", census: "manifest --count syndicate", contract: "contract", drone: "drone --self" }[id];
  termLine("> " + cmd + (target ? " --target " + target : ""));
  sound.play("type");
  socket.emit("darknet", { service: id, target: target || null });
  picker = null;
  drawDarknet(lastEco);
}

// ----- 송금: 은행 앱 -----
const bank = { to: null, amount: "" };

function drawBank(eco) {
  document.querySelector("#bank-balance").textContent = eco.credits;
  const box = document.querySelector("#bank-people");
  box.innerHTML = "";
  if (!eco.players.includes(bank.to)) bank.to = null;
  for (const name of eco.players) {
    const b = make("button", "person" + (bank.to === name ? " on" : ""));
    b.type = "button";
    b.dataset.to = name;
    b.appendChild(token(name));
    b.appendChild(make("span", null, name));
    box.appendChild(b);
  }
  drawBankAmount();
}

function drawBankAmount() {
  const n = Number(bank.amount || 0);
  document.querySelector("#bank-amount").textContent = n;
  const avail = lastEco ? lastEco.available : myCredits; // 입찰 중인 금액은 보낼 수 없음
  transferBtn.disabled = !bank.to || n < 1 || n > avail;
  transferBtn.textContent = bank.to && n > 0 ? bank.to + "에게 " + n + "만 보내기" : "보내기";
}

function drawEconomy(eco) {
  lastEco = eco;
  myCredits = eco.credits;
  drawDarknet(eco);
  drawBank(eco);
  drawAuction(); // 입찰 버튼은 보유 크레딧에 따라 켜지고 꺼짐
  drawInventory();
}

// 투표 버튼
function drawVote(data) {
  votePanel.innerHTML = "";
  votePanel.classList.toggle("hidden", !data.canVote);
  if (!data.canVote) return;

  data.candidates.forEach((name) => {
    const btn = make("button", "vote-btn");
    btn.appendChild(nameTag(name));
    btn.dataset.name = name;
    votePanel.appendChild(btn);
  });
}

// =====================================================
//  내가 하는 행동 → 서버로 보냄
// =====================================================

// =====================================================
//  캐릭터 꾸미기 (입장 화면)
// =====================================================
const MAKER_ROWS = [
  { key: "body", label: "몸 색" },
  { key: "top", label: "머리 위" },
  { key: "topColor", label: "모자 색" },
  { key: "eyes", label: "눈" },
  { key: "mouth", label: "입" },
  { key: "deco", label: "얼굴 장식" },
  { key: "neck", label: "목" },
];

// 지난번에 꾸민 캐릭터를 기억 (브라우저에 저장. 안 되면 매번 랜덤)
function loadAvatar() {
  try {
    const saved = JSON.parse(localStorage.getItem("wp-avatar"));
    if (saved) return cleanAvatar(saved);
  } catch (e) { /* 저장소를 쓸 수 없는 환경 */ }
  return randomAvatar();
}
function saveAvatar(a) {
  try { localStorage.setItem("wp-avatar", JSON.stringify(a)); } catch (e) { /* 무시 */ }
}

let myAvatar = loadAvatar();

function drawMaker() {
  document.querySelector("#maker-preview").src = avatarURL(myAvatar);
  const rows = document.querySelector("#maker-rows");
  rows.innerHTML = "";
  for (const r of MAKER_ROWS) {
    const list = AVATAR_PARTS[r.key];
    const opt = list[myAvatar[r.key]];
    const off = r.key === "topColor" && !TOP_USES_COLOR.has(myAvatar.top); // 색을 못 바꾸는 장식이면 잠금
    const row = make("div", "maker-row" + (off ? " off" : ""));
    const prev = make("button", "arrow", "◀");
    prev.type = "button";
    prev.dataset.key = r.key;
    prev.dataset.step = -1;
    prev.disabled = off;
    prev.setAttribute("aria-label", r.label + " 이전");
    const mid = make("div", "maker-mid");
    mid.appendChild(make("small", null, r.label));
    const val = make("span", "maker-val");
    if (opt.hex) {
      const sw = make("i", "swatch");
      sw.style.background = opt.hex;
      val.appendChild(sw);
    }
    val.appendChild(document.createTextNode(off ? "고정" : opt.name || opt));
    mid.appendChild(val);
    const next = make("button", "arrow", "▶");
    next.type = "button";
    next.dataset.key = r.key;
    next.dataset.step = 1;
    next.disabled = off;
    next.setAttribute("aria-label", r.label + " 다음");
    row.append(prev, mid, next);
    rows.appendChild(row);
  }
}

document.querySelector("#maker-rows").addEventListener("click", (e) => {
  const b = e.target.closest(".arrow");
  if (!b || b.disabled) return;
  const n = AVATAR_PARTS[b.dataset.key].length;
  myAvatar[b.dataset.key] = (myAvatar[b.dataset.key] + Number(b.dataset.step) + n) % n; // 끝에서 넘기면 처음으로
  sound.play("click");
  saveAvatar(myAvatar);
  drawMaker();
});
document.querySelector("#maker-random").addEventListener("click", () => {
  myAvatar = randomAvatar();
  saveAvatar(myAvatar);
  sound.play("reel");
  drawMaker();
});
drawMaker();

joinBtn.addEventListener("click", () => {
  socket.emit("join", { code: codeInput.value, name: nameInput.value, avatar: myAvatar });
  setMyName(nameInput.value.trim().slice(0, 12)); // 복도에서 내 방 표시용
});

// 드롭다운이 여러 개라 부모 하나에만 이벤트를 걸고, 어떤 드롭다운인지는 data-key로 구분
optionList.addEventListener("change", (e) => {
  socket.emit("setOption", { key: e.target.dataset.key, value: e.target.value });
});

// + / − 버튼도 같은 방식
roleList.addEventListener("click", (e) => {
  const btn = e.target.closest(".ban-card");
  if (!btn || btn.disabled) return;
  sound.play("click");
  socket.emit("toggleBan", { id: btn.dataset.id });
});

startBtn.addEventListener("click", () => socket.emit("start"));

chatForm.addEventListener("submit", (e) => {
  e.preventDefault(); // 새로고침 막기
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat", text);
  chatInput.value = "";
});

votePanel.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  sound.play("click");
  socket.emit("vote", btn.dataset.name);
});

actionBtn.addEventListener("click", () => {
  const mode = actionModes.querySelector("input:checked");
  socket.emit("nightAction", {
    target: actionTarget.value,
    target2: actionTarget2.value,
    mode: mode ? mode.value : null,
  });
});

darknetList.addEventListener("click", (e) => {
  const btn = e.target.closest("button.run");
  if (!btn || btn.disabled) return;
  const svc = lastEco.services.find((s) => s.id === btn.dataset.service);
  if (!svc.target) return runService(svc.id, null);
  picker = picker && picker.id === svc.id ? null : { kind: "svc", id: svc.id };
  drawDarknet(lastEco);
});

// 은행: 받는 사람 → 키패드로 금액 → 보내기
document.querySelector("#bank-people").addEventListener("click", (e) => {
  const b = e.target.closest("[data-to]");
  if (!b) return;
  bank.to = b.dataset.to;
  drawBank(lastEco);
});
document.querySelector("#keypad").addEventListener("click", (e) => {
  const k = e.target.closest("[data-key]");
  if (!k) return;
  const key = k.dataset.key;
  if (key === "del") bank.amount = bank.amount.slice(0, -1);
  else if (key === "all") bank.amount = String(myCredits);
  else if (bank.amount.length < 4) bank.amount = (bank.amount + key).replace(/^0+/, "");
  if (Number(bank.amount) > myCredits) bank.amount = String(myCredits); // 잔액 이상은 못 넣음
  drawBankAmount();
});
transferBtn.addEventListener("click", () => {
  socket.emit("transfer", { target: bank.to, amount: Number(bank.amount) });
  bank.amount = "";
  drawBankAmount();
});

meRole.addEventListener("click", () => setTab("info"));

// 결과 화면 버튼
document.querySelector("#restart-btn").addEventListener("click", () => socket.emit("restart"));
document.querySelector("#to-lobby-btn").addEventListener("click", () => socket.emit("backToLobby"));
document.querySelector("#leave-btn").addEventListener("click", () => location.reload()); // 새로고침 = 접속 끊고 첫 화면

// =====================================================
//  서버가 보낸 소식 → 화면에 반영
// =====================================================

socket.on("lobby", (data) => {
  show("lobby");
  updateMusic();
  hideResult();
  hideIntro();
  stopSequence();
  const isHost = data.hostId === socket.id;
  const check = data.check;

  lobbyCode.textContent = data.code;
  playerCount.textContent = data.players.length + " / " + data.maxPlayers + "명";

  playerList.innerHTML = "";
  rememberColors(data.players);
  data.players.forEach((p) => {
    const host = p.name === data.hostName;
    const li = make("li", host ? "host" : "");
    li.appendChild(nameTag(p.name));
    if (host) li.appendChild(make("span", "crown", "♛"));
    else if (isHost) {
      const give = make("button", "give-host", "♛ 위임");
      give.title = p.name + "에게 방장 넘기기";
      give.type = "button";
      give.dataset.give = p.name;
      li.appendChild(give);
    }
    playerList.appendChild(li);
  });

  for (const id in data.catalog.roles) roleIdByName[data.catalog.roles[id].name] = id;
  drawOptions(data.catalog.options, data.settings, isHost);
  drawRoles(data.catalog, data.settings, check, isHost);

  // 인원수에 따른 구성 안내 (실제 직업은 시작할 때 랜덤)
  const plan = check.plan;
  const n = data.players.length;
  const special = plan.special[0] === plan.special[1] ? plan.special[0] : plan.special[0] + "~" + plan.special[1];
  roleSummary.textContent =
    n + "명 기준 · VIP 1 · 신디케이트 " + plan.syndicate + " · 시민팀 특수 직업 " + special +
    (plan.third ? " · 제3세력 " + Math.round(plan.third * 100) + "% 확률" : "") +
    " · 나머지는 시민 · 착륙 " + check.landingDays + "일차";

  checkErrors.innerHTML = "";
  check.errors.forEach((msg) => checkErrors.appendChild(make("li", null, msg)));

  startBtn.classList.toggle("hidden", !isHost);
  startBtn.disabled = check.errors.length > 0;
  lobbyNote.textContent = isHost ? "당신은 방장입니다." : "방장이 시작하기를 기다리는 중...";
});

// 게임 시작 시 나만 받는 직업 정보
socket.on("yourRole", (role) => {
  chatLog.innerHTML = ""; // 새 게임이니 지난 대화, 기록 지우기
  resetMemo();
  resetDM();
  resetLog();
  lastHp = null;
  shownCredits = null;
  intelLog.innerHTML = "";
  meRole.textContent = "";
  meRole.append(roleIcon(role.id), " " + role.name);
  meRole.className = "me-role " + role.teamId;
  roleCard.innerHTML = "";
  roleCard.className = "role-card " + role.teamId;
  roleCard.appendChild(make("small", null, role.team));
  const title = make("strong", "role-title");
  title.append(roleIcon(role.id, "big"), " " + role.name);
  roleCard.appendChild(title);
  roleCard.appendChild(make("p", null, role.desc));
  if (role.allies.length > 0) {
    roleCard.appendChild(make("p", "allies", "동료: " + role.allies.join(", ")));
  }
  if (role.extra) roleCard.appendChild(make("p", "allies", role.extra));
  // 이번 판에 나올 수 있는 직업 (실제로 뽑힌 직업은 비공개)
  if (role.pool) {
    const box = make("div", "pool-box");
    box.appendChild(make("small", null, "이번 판에 나올 수 있는 직업"));
    for (const team of ["citizen", "syndicate", "third"]) {
      if (!role.pool[team]) continue;
      const row = make("p", "pool-row " + team);
      row.appendChild(make("b", null, { citizen: "시민팀", syndicate: "신디케이트", third: "제3세력" }[team]));
      for (const name of role.pool[team]) {
        const chip = make("span", "pool-chip");
        chip.append(roleIcon(roleIdByName[name]), name);
        row.appendChild(chip);
      }
      box.appendChild(row);
    }
    roleCard.appendChild(box);
  }
  setIntroRole(role); // 시작 연출 카드에도 같은 내용
});

// 내 체력과 크레딧
// 카지노 연출 중에는 결과가 미리 보이지 않도록 잠깐 보류했다가 연출이 끝나면 반영 (casino.js가 casinoHold를 켜고 끔)
let pendingStatus = null;
let casinoHold = false;
function flushStatus() {
  if (pendingStatus) drawStatus(pendingStatus);
  pendingStatus = null;
}
let lastHp = null;
let shownCredits = null;
let countTimer = null;
let deltaTimer = null;

function drawStatus(s) {
  // ----- 체력: 큰 하트 칸 -----
  const state = !s.alive ? "dead" : s.hp < s.maxHp ? "hurt" : "ok";
  hpBox.className = "hp " + state;
  hpBox.innerHTML = "";
  for (let i = 0; i < s.maxHp; i++) {
    const full = i < s.hp;
    // 방금 잃은 칸은 금 간 하트, 원래 빈 칸은 빈 하트
    const lostNow = !full && lastHp !== null && i < lastHp;
    hpBox.appendChild(icon(full ? "heart" : lostNow ? "heartCracked" : "heartEmpty", full ? "on" : "off"));
  }
  hpBox.setAttribute("aria-label", "체력 " + s.hp + " / " + s.maxHp + (state === "hurt" ? " (부상)" : state === "dead" ? " (사망)" : ""));
  if (lastHp !== null && s.hp < lastHp) {
    flashHurt(); // 체력이 줄면 내 화면 가장자리만 붉게
    sound.play("hurt");
  }
  if (lastHp !== null && lastHp > 0 && !s.alive) {
    // 사망 알림은 아침 CCTV / 처형 연출이 끝난 뒤에 (미리 보이면 김이 샘)
    pendingDeath = ({
      kicker: currentDay + "일차",
      title: "당신은 사망했습니다",
      tone: "dead",
      lines: [
        { icon: "skull", tone: "bad", text: "이제 말할 수도, 투표할 수도 없어요." },
        { icon: "eye", text: "관전 모드: 밤에는 모든 1:1 대화를, 낮에는 그룹 채팅을 볼 수 있어요." },
      ],
    });
    // 아침·처형 연출이 없는 경우(접속 끊김 등)에만 1.5초 뒤 바로 보여 줌
    setTimeout(() => {
      const ph = screens.game.dataset.phase;
      if (pendingDeath && ph !== "morning" && ph !== "result") onReplayDone("");
    }, 1500);
  }
  lastHp = s.hp;

  // ----- 크레딧: 숫자가 굴러가며 바뀌고, 옆에 +/- 표시 -----
  myCredits = s.credits;
  if (shownCredits === null) shownCredits = s.credits;
  const from = shownCredits;
  const diff = s.credits - from;
  if (diff !== 0) {
    sound.play(diff > 0 ? "coin" : "spend");
    creditDelta.textContent = (diff > 0 ? "+" : "") + diff;
    creditDelta.className = "credit-delta show " + (diff > 0 ? "up" : "down");
    creditBox.classList.remove("bump-up", "bump-down");
    creditBox.getBoundingClientRect();
    creditBox.classList.add(diff > 0 ? "bump-up" : "bump-down");
    clearTimeout(deltaTimer);
    deltaTimer = setTimeout(() => (creditDelta.className = "credit-delta"), 1400);

    const start = performance.now();
    cancelAnimationFrame(countTimer);
    const step = (now) => {
      const t = Math.min(1, (now - start) / 600);
      creditNum.textContent = Math.round(from + diff * (1 - Math.pow(1 - t, 3)));
      if (t < 1) countTimer = requestAnimationFrame(step);
    };
    countTimer = requestAnimationFrame(step);
  } else {
    creditNum.textContent = s.credits;
  }
  shownCredits = s.credits;
  if (typeof drawBetBar === "function") drawBetBar(); // 카지노 판돈 최대치
}

function flashHurt() {
  const v = document.querySelector("#hurt-vignette");
  v.classList.remove("show");
  v.getBoundingClientRect();
  v.classList.add("show");
}
socket.on("status", (s) => {
  if (casinoHold) pendingStatus = s;
  else drawStatus(s);
});

socket.on("economy", (eco) => drawEconomy(eco));
socket.on("econMsg", (text) => {
  addLine("◆ " + text, "system econ");
  if (/낙찰!|보냈다|받았다|의뢰 완료|위조 완료|사용 →|정리됐다/.test(text)) addLog(currentDay, "money", text);
  if (text.includes("의뢰 완료")) ghostFace("smile");
  else if (text.includes("다크넷은 하룻밤") || text.includes("크레딧이 부족")) ghostFace("wary");
  if (text.includes("더 높은 입찰")) {
    sound.play("sold");
    if (!isVisible("auction")) setDot("auction", true);
  }
  if (text.includes("통신이 차단") || text.includes("방화벽")) toast(text);
  if (text.includes("통신이 차단됐다")) {
    dm.blocked = true;
    drawDM();
  }
});

// 고스트 그림: 표정 그림이 없으면 기본 그림으로, 기본 그림도 없으면 G 동그라미로
const ghostImg = document.querySelector("#ghost-img");
function onGhostError() {
  if (ghostImg.src.includes("ghost_default")) ghostImg.classList.add("hidden");
  else ghostImg.src = "img/ghost/ghost_default.png";
}
ghostImg.addEventListener("error", onGhostError);
ghostImg.addEventListener("load", () => ghostImg.classList.remove("hidden"));
if (ghostImg.complete && ghostImg.naturalWidth === 0) onGhostError();

// 고스트 표정 바꾸기 (그림 파일이 있을 때만 보임) → 2.5초 뒤 기본 표정
let ghostTimer = null;
function ghostFace(mood) {
  const img = ghostImg;
  if (img.classList.contains("hidden")) return; // 그림이 아직 없음
  img.src = "img/ghost/ghost_" + mood + ".png";
  img.classList.remove("pop");
  img.getBoundingClientRect();
  img.classList.add("pop");
  clearTimeout(ghostTimer);
  ghostTimer = setTimeout(() => (img.src = "img/ghost/ghost_default.png"), 2500);
}

socket.on("actionSet", (text) => {
  targeting.locked = [...targeting.picks];
  refreshTargeting();
  actionChosen.textContent = "선택 완료 → " + text + " (밤이 끝나기 전까지 바꿀 수 있음)";
});

// 생존 현황 → 객실 복도
socket.on("board", (players) => {
  lastBoard = players;
  renderRooms(players);
  drawMemo();
  applyMemoMarks();
});

// 단계 타이틀 카드: 어떤 단계에 무엇을 띄울지. 띄웠으면 true
let lastCardKey = "";
function phaseCard(data) {
  if (data.phase === "intro") lastCardKey = ""; // 새 게임 시작 시 기록 초기화
  const key = data.phase + data.day;
  if (key === lastCardKey) return false;
  lastCardKey = key;

  if (data.phase === "night") {
    showPhaseCard(data.day + "일차 밤", data.alive ? "통행금지 · 능력 · 메신저 · 경매" : "관전 중", "night");
  } else if (data.phase === "morning") {
    showPhaseCard(data.day + "일차 아침", "선내 방송", "morning");
  } else if (data.phase === "day") {
    showPhaseCard(data.day + "일차 낮", data.alive ? "카지노 · 그룹 채팅" + (data.voteToday ? " · 끝나면 투표" : "") : "관전 중", "talk");
  } else if (data.phase === "vote") {
    showPhaseCard("투표", data.canVote ? "비행선 밖으로 던질 사람을 고르세요" : "관전 중", "vote");
  } else {
    return false;
  }
  return true;
}

// 단계가 바뀔 때마다 받는 정보
socket.on("phase", (data) => {
  show("game");
  dayLabel.textContent = data.day + "일차";
  phaseLabel.textContent = data.title;
  currentDay = data.day;
  const PHASE_ICONS = { intro: "ship", day: "appCasino", night: "moon", morning: "sun", vote: "ballot", result: "ballot", over: "ship" };
  phaseIcon.innerHTML = "";
  phaseIcon.appendChild(icon(PHASE_ICONS[data.phase] || "ship"));
  picker = null; // 단계가 바뀌면 펼쳐둔 선택 칸 닫기
  screens.game.dataset.phase = data.phase; // CSS에서 밤/낮 분위기 바꾸는 용도
  startTimer(data.seconds);

  if (typeof casinoPhase === "function") casinoPhase(data); // 낮이 끝나면 진행 중이던 카지노 화면 정리
  drawPrivate(data.private);
  drawAction(data.phase === "night" ? data.action : null);
  setupTabs(data);

  // 나만 보는 결과는 "내 정보" 탭에도 날짜별로 쌓아둠
  for (const line of data.private || []) {
    intelLog.appendChild(make("li", null, data.day + "일차 · " + line));
    if (!isVisible("info")) setDot("info", true);
  }
  // 게임 기록 + 아침 알림 카드
  if (data.phase !== "intro") {
    for (const line of data.lines || []) addLog(data.day, "public", line);
    for (const line of data.private || []) addLog(data.day, "private", line);
  }
  if (data.phase === "morning" && data.private && data.private.length) {
    queuePrivateCard(data.day - 1, data.private, !data.sequence);
  }
  drawVote(data);
  phaseInfo.textContent = data.info || "";

  // 채팅 칸: 말할 수 있는 단계에서만 열림
  chatInput.disabled = !data.canChat;
  sendBtn.disabled = !data.canChat; // 말할 수 없을 땐 전송 버튼도 회색
  chatInput.placeholder = data.canChat
    ? data.phase === "night" ? "신디케이트 암호화 채널" : "그룹 채팅 · 모두에게"
    : data.phase === "night" && data.alive ? "밤에는 메신저 앱으로 1:1 대화" : "지금은 말할 수 없습니다";
  if (data.canChat) chatInput.focus();

  setupDM(data);
  canBid = data.phase === "night" && data.alive;
  drawAuction();

  // ----- 연출 -----
  if (data.phase === "intro") showIntro(data.shipName);
  else hideIntro();

  // 단계가 바뀌는 순간 타이틀 카드
  const cardShown = phaseCard(data);
  const PHASE_SFX = { night: "night", morning: "morning", day: "speech", vote: "vote" };
  if (cardShown && PHASE_SFX[data.phase]) sound.play(PHASE_SFX[data.phase]);

  // 낮·투표·결과: 채팅 위에 원형 지도
  if (data.phase === "day") {
    showStage("day", {
      title: "카지노 라운지 · 그룹 채팅",
      hint: data.alive ? "아래 입력창에 말하면 지도에 말풍선으로 떠요" : "관전 중",
    });
  } else if (data.phase === "vote") {
    showStage("vote", {
      title: "투표",
      hint: data.canVote ? "비행선 밖으로 던질 사람의 방을 누르세요" : "투표가 진행 중입니다",
      candidates: data.canVote ? data.candidates : [],
    });
  } else if (data.phase === "result") {
    showStage("result", { title: "투표 결과" });
  } else {
    hideStage();
  }
  updateMusic();

  // 아침 발표, 투표 결과: 선내 방송 + 복도 애니메이션 / 그 외 단계: 재생 중이던 방송 정리
  if (data.sequence) playSequence(data.sequence, data.phase, cardShown ? PHASE_CARD_MS : 0);
  else stopSequence();

  if (data.phase === "over") showResult(data, data.isHost);
  else hideResult();

  // 로그에 단계 구분선 + 발표 내용 (다음 단계로 넘어가도 다시 볼 수 있게)
  if (data.phase === "intro") return;
  addLine("── " + data.day + "일차 · " + data.title + " ──", "divider");
  for (const line of data.lines || []) addLine("📢 " + line, "bc-line");
  // 투표 득표 수도 기록 (누가 누구를 찍었는지는 비공개)
  if (data.results && data.results.length) {
    addLine("득표: " + data.results.map((r) => r.name + " " + r.count + "표").join(", "), "bc-line");
  }
});

socket.on("voted", (name) => {
  for (const btn of votePanel.querySelectorAll("button")) {
    btn.classList.toggle("picked", btn.dataset.name === name);
  }
  setVotePick(name); // 지도에도 표시
});

const CHANNEL_TAG = { syndicate: "[암호화] ", group: "", wiretap: "[도청] " };

socket.on("chat", (msg) => {
  const mine = msg.fromId === socket.id;
  // [채널] (토큰)이름: 내용  — 이름은 그 사람의 고유 색
  const line = document.createDocumentFragment();
  if (CHANNEL_TAG[msg.channel]) line.appendChild(make("span", "tag", CHANNEL_TAG[msg.channel]));
  if (mine) line.appendChild(make("span", "name", "나"));
  else line.appendChild(nameTag(msg.from, true));
  line.appendChild(make("span", "text", ": " + msg.text));
  addLine(line, (mine ? "me" : "them") + " " + msg.channel);

  if (msg.channel === "group") mapSay(msg.from, msg.text); // 낮 그룹 채팅: 원형 지도 위 말풍선
  sound.play(msg.channel === "wiretap" ? "whisper" : mine ? "msgOut" : "msgIn");
});

socket.on("errorMsg", (msg) => {
  sound.play("error");
  errorEl.textContent = msg;
  document.querySelector("#result-note").textContent = msg; // 결과 화면에서 재시작이 안 될 때 이유 표시
});

// =====================================================
//  메모장 (내 브라우저에만 저장, 새 게임이 시작되면 비움)
// =====================================================
const MEMO_MARKS = [
  { id: "", label: "—", title: "표시 없음" },
  { id: "trust", label: "믿음", title: "믿을 만함" },
  { id: "unsure", label: "애매", title: "잘 모르겠음" },
  { id: "suspect", label: "의심", title: "의심됨" },
];
let lastBoard = [];
const roleIdByName = {}; // 직업 이름 → id (아이콘 찾기용, 로비에서 채움)
let memo = loadMemo();
function loadMemo() {
  try {
    const m = JSON.parse(localStorage.getItem("wp-memo"));
    if (m && m.people) return m;
  } catch (e) {}
  return { people: {}, free: "" };
}
function saveMemo() {
  try {
    localStorage.setItem("wp-memo", JSON.stringify(memo));
  } catch (e) {}
}
function resetMemo() {
  memo = { people: {}, free: "" };
  saveMemo();
  document.querySelector("#memo-free").value = "";
  drawMemo();
  applyMemoMarks();
}

const memoPeople = document.querySelector("#memo-people");
const memoFree = document.querySelector("#memo-free");
memoFree.value = memo.free;

function drawMemo() {
  memoPeople.innerHTML = "";
  for (const p of lastBoard) {
    if (p.name === myName) continue;
    const m = memo.people[p.name] || { mark: "", note: "" };
    const row = make("div", "memo-row" + (p.alive ? "" : " dead"));
    row.dataset.name = p.name;
    const who = make("span", "memo-who");
    who.appendChild(nameTag(p.name, true));
    if (!p.alive) who.appendChild(make("small", null, "사망"));
    const marks = make("span", "memo-marks");
    for (const mk of MEMO_MARKS) {
      const b = make("button", "mk " + (mk.id || "none") + (m.mark === mk.id ? " on" : ""), mk.label);
      b.type = "button";
      b.dataset.mark = mk.id;
      b.title = mk.title;
      marks.appendChild(b);
    }
    const note = make("input", "memo-note");
    note.maxLength = 40;
    note.placeholder = "한 줄 메모 (예: 자칭 리퍼닥)";
    note.value = m.note;
    row.append(who, marks, note);
    memoPeople.appendChild(row);
  }
}

memoPeople.addEventListener("click", (e) => {
  const b = e.target.closest(".mk");
  if (!b) return;
  const name = b.closest(".memo-row").dataset.name;
  const m = (memo.people[name] = memo.people[name] || { mark: "", note: "" });
  m.mark = b.dataset.mark;
  saveMemo();
  sound.play("click");
  for (const x of b.parentElement.children) x.classList.toggle("on", x === b);
  applyMemoMarks();
});
memoPeople.addEventListener("input", (e) => {
  if (!e.target.classList.contains("memo-note")) return;
  const name = e.target.closest(".memo-row").dataset.name;
  const m = (memo.people[name] = memo.people[name] || { mark: "", note: "" });
  m.note = e.target.value;
  saveMemo();
});
memoFree.addEventListener("input", () => {
  memo.free = memoFree.value;
  saveMemo();
});

// 복도 이름표와 선내 지도에 작은 표시 달기
function applyMemoMarks() {
  for (const old of document.querySelectorAll(".memo-mark")) old.remove();
  for (const name in memo.people) {
    const mark = memo.people[name].mark;
    if (!mark) continue;
    const label = MEMO_MARKS.find((m) => m.id === mark)?.label;
    for (const room of [stripRoomOf(name), roomOf(name)]) {
      if (room) room.appendChild(make("span", "memo-mark " + mark, label));
    }
  }
}

// 음악 / 효과음 켜기·끄기 (브라우저에 기억). 같은 버튼이 입장 화면과 HUD에 하나씩 있음
const AUDIO_BTN = {
  music: { off: () => sound.isMusicMuted(), set: (m) => sound.setMusicMuted(m), on: "music", offIcon: "musicOff", name: "음악" },
  sfx: { off: () => sound.isMuted(), set: (m) => sound.setMuted(m), on: "soundOn", offIcon: "soundOff", name: "효과음" },
};
function drawSoundBtns() {
  for (const btn of document.querySelectorAll("[data-audio]")) {
    const kind = AUDIO_BTN[btn.dataset.audio];
    const off = kind.off();
    btn.innerHTML = "";
    btn.appendChild(icon(off ? kind.offIcon : kind.on));
    btn.classList.toggle("off", off);
    btn.setAttribute("aria-label", kind.name + (off ? " 켜기" : " 끄기"));
    btn.title = kind.name + (off ? " 켜기" : " 끄기");
  }
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-audio]");
  if (!btn) return;
  const kind = AUDIO_BTN[btn.dataset.audio];
  kind.set(!kind.off());
  drawSoundBtns();
  sound.play("click");
});
drawSoundBtns();

// 지금 어떤 배경음악이 나와야 하는지: 화면 + 게임 단계 + (밤이면) 열린 탭
const PHASE_MUSIC = { intro: "lobby", day: "talk", night: "night", morning: null, vote: "vote", result: "vote", over: null };
function updateMusic() {
  if (screens.game.classList.contains("hidden")) return sound.music("lobby"); // 입장·로비
  const phase = screens.game.dataset.phase;
  if (phase === "day" && currentTab === "casino") return sound.music("casino");
  sound.music(PHASE_MUSIC[phase] ?? null);
}
updateMusic();

// =====================================================
//  로비 채팅 · 방장 넘기기
// =====================================================
const lobbyLogEl = document.querySelector("#lobby-log");
socket.on("lobbyChat", (m) => {
  const li = make("li", m.system ? "system" : m.fromId === socket.id ? "me" : "");
  if (m.system) li.textContent = "· " + m.text;
  else {
    li.appendChild(nameTag(m.from, true));
    li.appendChild(make("span", "text", ": " + m.text));
    if (m.fromId !== socket.id) sound.play("msgIn");
  }
  lobbyLogEl.appendChild(li);
  while (lobbyLogEl.children.length > 150) lobbyLogEl.firstChild.remove();
  lobbyLogEl.scrollTop = lobbyLogEl.scrollHeight;
});
document.querySelector("#lobby-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.querySelector("#lobby-input");
  const text = input.value.trim();
  if (!text) return;
  socket.emit("lobbyChat", text);
  input.value = "";
});
playerList.addEventListener("click", (e) => {
  const b = e.target.closest("[data-give]");
  if (!b) return;
  // 실수 방지: 두 번 눌러야 넘어감
  if (!b.classList.contains("confirm")) {
    b.classList.add("confirm");
    b.textContent = "확인";
    setTimeout(() => { b.classList.remove("confirm"); b.textContent = "♛ 위임"; }, 3000);
    return;
  }
  socket.emit("transferHost", b.dataset.give);
});

// 전원이 투표하면 몇 초 뒤 바로 마감
socket.on("voteClosing", (seconds) => {
  toast("전원이 투표했습니다. 곧 마감합니다.");
  startTimer(seconds);
});

// =====================================================
//  밤 1:1 메신저 (LEVIA TALK)
//  살아있는 사람: 연락처 = 상대 이름, 대화는 나와 그 사람
//  사망자(관전): 연락처 = "A ↔ B" 대화방, 읽기만
// =====================================================
const dm = {
  contacts: document.querySelector("#dm-contacts"),
  with: document.querySelector("#dm-with"),
  log: document.querySelector("#dm-log"),
  form: document.querySelector("#dm-form"),
  input: document.querySelector("#dm-input"),
  send: document.querySelector("#dm-send"),
  state: document.querySelector("#dm-state"),
  threads: {}, // { 대화방 키: [{ from, to, text }] }
  unread: {},
  people: [], // 오늘 밤 연락처 (살아있는 사람)
  open: null,
  spectate: false,
  night: false,
};

function resetDM() {
  dm.threads = {};
  dm.unread = {};
  dm.open = null;
  drawDM();
}

// 대화방 키: 관전 = "A ↔ B" / 도청 사본 = "🎧 대상" / 위조 사본(내가 보낸 것) = 받는 사람 / 평소 = 상대 이름
function dmKey(msg) {
  if (dm.spectate) return [msg.from, msg.to].sort().join(" ↔ ");
  if (msg.tap) return "🎧 " + msg.tap;
  if (msg.forged) return msg.to;
  return msg.from === myName ? msg.to : msg.from;
}

function tapRoom0() {
  return !!(dm.open && dm.open.startsWith("🎧"));
}

function setupDM(data) {
  if (data.phase === "night" && !dm.night) dm.blocked = false; // 새 밤: 차단 풀림
  dm.night = data.phase === "night";
  dm.spectate = !!(data.dm && data.dm.spectate);
  dm.people = data.dm && data.dm.contacts ? data.dm.contacts : [];
  if (dm.open && !dm.spectate && !dm.people.includes(dm.open)) dm.open = null;
  drawDM();
}

function drawDM() {
  // 연락처: 살아있는 상대 전원 (+ 지난 밤 대화 상대) / 관전: 오간 대화방
  const keys = dm.spectate ? Object.keys(dm.threads) : [...new Set([...dm.people, ...Object.keys(dm.threads)])];
  dm.contacts.innerHTML = "";
  if (!keys.length) dm.contacts.appendChild(make("li", "dm-none", dm.spectate ? "아직 오간 대화가 없어요" : ""));
  for (const key of keys) {
    const li = make("li");
    const b = make("button", "dm-contact" + (dm.open === key ? " on" : ""));
    b.type = "button";
    b.dataset.key = key;
    const box = make("span");
    if (dm.spectate || key.startsWith("🎧")) box.appendChild(make("span", "name", key));
    else box.appendChild(nameTag(key, true));
    const last = (dm.threads[key] || []).at(-1);
    if (last) box.appendChild(make("span", "preview", last.text));
    b.appendChild(box);
    if (dm.unread[key]) b.appendChild(make("span", "unread", String(dm.unread[key])));
    li.appendChild(b);
    dm.contacts.appendChild(li);
  }

  // 대화창
  dm.log.innerHTML = "";
  const canTalk = dm.night && !dm.spectate && dm.open && dm.people.includes(dm.open) && !dm.blocked;
  dm.with.textContent = dm.open ? (dm.spectate ? "관전 · " + dm.open : tapRoom0() ? "도청 중 · " + dm.open.slice(3) + "의 1:1 대화" : dm.open + " 님과의 대화") : dm.spectate ? "대화방을 고르면 내용을 볼 수 있어요" : "왼쪽에서 대화할 사람을 고르세요";
  const list = dm.open ? dm.threads[dm.open] || [] : [];
  if (dm.open && !list.length) dm.log.appendChild(make("li", "empty", "아직 메시지가 없어요"));
  const tapRoom = dm.open && dm.open.startsWith("🎧");
  for (const m of list) {
    const mine = !dm.spectate && !tapRoom && (m.from === myName || m.forged);
    const li = make("li", (mine ? "me" : "") + (m.forged ? " forged" : ""));
    if (tapRoom) li.appendChild(make("small", null, m.from + " → " + m.to));
    else if (dm.spectate) li.appendChild(make("small", null, m.from + (m.forged ? " (위조된 메시지)" : "")));
    else if (m.forged) li.appendChild(make("small", null, "위조 · " + m.from + " 이름으로 보냄"));
    li.appendChild(document.createTextNode(m.text));
    dm.log.appendChild(li);
  }
  dm.log.scrollTop = dm.log.scrollHeight;
  dm.input.disabled = !canTalk;
  dm.send.disabled = !canTalk;
  dm.input.placeholder = dm.spectate ? "관전 중에는 말할 수 없어요" : !dm.night ? "메신저는 밤에만 열려요" : dm.blocked ? "통신 차단됨 · 오늘 밤엔 보낼 수 없어요" : tapRoom0() ? "도청 중인 대화엔 끼어들 수 없어요" : dm.open ? "1:1 메시지" : "상대를 먼저 고르세요";
  dm.state.textContent = dm.spectate ? "GHOST MODE" : dm.night ? "통행금지 · 1:1만 가능" : "오프라인";
  const total = Object.values(dm.unread).reduce((a, b) => a + b, 0);
  setDot("dm", total > 0 && !isVisible("dm"));
}

dm.contacts.addEventListener("click", (e) => {
  const b = e.target.closest("[data-key]");
  if (!b) return;
  sound.play("tab");
  dm.open = b.dataset.key;
  dm.unread[dm.open] = 0;
  drawDM();
  if (!dm.input.disabled) dm.input.focus();
});

dm.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = dm.input.value.trim();
  if (!text || !dm.open) return;
  socket.emit("dm", { to: dm.open, text });
  dm.input.value = "";
});

socket.on("dm", (msg) => {
  const key = dmKey(msg);
  (dm.threads[key] = dm.threads[key] || []).push({ from: msg.from, to: msg.to, text: msg.text, forged: !!msg.forged && (dm.spectate || !msg.tap) });
  const mine = msg.fromId === socket.id || (msg.forged && !dm.spectate);
  if (!(dm.open === key && isVisible("dm"))) dm.unread[key] = (dm.unread[key] || 0) + (mine ? 0 : 1);
  drawDM();
  sound.play(mine ? "msgOut" : "msgIn");
});

// 통신 차단당함
socket.on("dmBlocked", () => {
  dm.blocked = true;
  toast("통신이 차단돼 메시지를 보낼 수 없습니다.");
  sound.play("error");
  drawDM();
});
// 채팅 도청: 이미 오간 대화를 한꺼번에 받음
socket.on("tapLog", ({ target, msgs }) => {
  const key = "🎧 " + target;
  dm.threads[key] = [...msgs.map((m) => ({ from: m.from, to: m.to, text: m.text })), ...(dm.threads[key] || [])];
  dm.unread[key] = (dm.unread[key] || 0) + msgs.length;
  drawDM();
  toast("도청 시작 · " + target + "의 1:1 대화가 메신저에 들어옵니다.");
});

// =====================================================
//  아침 알림 카드: 나만 받은 밤 결과를 종류별 아이콘으로
//  방패 = 방어 · 눈 = 정보 · 코인 = 돈 · 십자 = 치료 · 해골 = 위험
// =====================================================
function classifyPrivate(text) {
  if (/방해했다|매수했다|투여했다|주선했다/.test(text)) return { icon: "eye", tone: "info" }; // 내 능력이 통한 결과
  if (/막아냈|막혔|방화벽|장갑|대신 받아/.test(text)) return { icon: "shield", tone: "good" };
  if (/보수|\+\d+만|크레딧을 받/.test(text)) return { icon: "credit", tone: "money" };
  if (/치료|드론/.test(text)) return { icon: "medic", tone: "good" };
  if (/독|공격이 무산|실패|방해받아|사라졌다/.test(text)) return { icon: "skull", tone: "bad" };
  if (/조사|직업|감시|체력|지목|통신 기록|명부|송금 로그|크레딧:|방해했다|매수했다|투여했다/.test(text)) return { icon: "eye", tone: "info" };
  return { icon: "inbox", tone: "" };
}

let pendingPrivate = null;
let pendingDeath = null;
function queuePrivateCard(nightDay, lines, now) {
  pendingPrivate = {
    kicker: nightDay + "일차 밤 · 나만 아는 결과",
    title: "나에게 일어난 일",
    lines: lines.map((text) => ({ ...classifyPrivate(text), text })),
  };
  if (now) onReplayDone("morning");
}

// fx.js가 아침 CCTV 재생을 끝내면 부름
function onReplayDone(mode) {
  if (mode === "morning" && pendingPrivate) {
    showNotice(pendingPrivate);
    pendingPrivate = null;
  }
  if (pendingDeath) showNotice(pendingDeath);
  pendingDeath = null;
  flushNotices();
}

// =====================================================
//  게임 기록: 날짜별로 공개 발표 / 나만 아는 것 / 거래
// =====================================================
const gameLog = { el: document.querySelector("#game-log"), entries: [], filter: "all" };
const LOG_LABEL = { public: "📢", private: "🔒", money: "◆" };

function resetLog() {
  gameLog.entries = [];
  drawLog();
}

function addLog(day, kind, text) {
  gameLog.entries.push({ day, kind, text });
  drawLog();
}

function drawLog() {
  const box = gameLog.el;
  box.innerHTML = "";
  const list = gameLog.entries.filter((e) => gameLog.filter === "all" || e.kind === gameLog.filter);
  if (!list.length) {
    box.appendChild(make("p", "inv-empty", "아직 기록이 없어요."));
    return;
  }
  let day = null;
  let ul = null;
  for (const e of list) {
    if (e.day !== day) {
      day = e.day;
      box.appendChild(make("h4", "log-day", day + "일차"));
      ul = make("ul", "log-list");
      box.appendChild(ul);
    }
    const li = make("li", "log-" + e.kind);
    li.appendChild(make("span", "log-tag", LOG_LABEL[e.kind]));
    li.appendChild(make("span", null, e.text));
    ul.appendChild(li);
  }
  box.scrollTop = box.scrollHeight;
}

document.querySelector("#log-filter").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  gameLog.filter = b.dataset.f;
  for (const x of b.parentElement.children) x.classList.toggle("on", x === b);
  drawLog();
});

// =====================================================
//  도감: 서버가 게임 시작 때 보내는 설명 모음
// =====================================================
let catalog = null;
let dexTab = "roles";
const dexBody = document.querySelector("#dex-body");
const TEAM_KO = { citizen: "시민팀", syndicate: "신디케이트", third: "제3세력" };
const WHEN_KO = { now: "즉시", tonight: "오늘 밤", morning: "아침에 결과", tomorrow: "내일 투표", multi: "여러 날" };

socket.on("catalog", (c) => {
  catalog = c;
  drawDex();
});

function dexCard(iconEl, title, sub, desc, cls) {
  const card = make("div", "dex-card " + (cls || ""));
  const head = make("div", "dex-head");
  if (iconEl) head.appendChild(iconEl);
  const t = make("div");
  t.appendChild(make("strong", null, title));
  if (sub) t.appendChild(make("small", null, sub));
  head.appendChild(t);
  card.appendChild(head);
  card.appendChild(make("p", null, desc));
  return card;
}

function drawDex() {
  dexBody.innerHTML = "";
  if (!catalog) {
    dexBody.appendChild(make("p", "inv-empty", "게임이 시작되면 열려요."));
    return;
  }
  const pool = new Set(catalog.pool);
  if (dexTab === "roles") {
    for (const team of ["citizen", "syndicate", "third"]) {
      dexBody.appendChild(make("h4", "log-day " + team, TEAM_KO[team]));
      for (const id in catalog.roles) {
        const r = catalog.roles[id];
        if (r.team !== team) continue;
        const card = dexCard(roleIcon(id, "dex-ico"), r.name, pool.has(id) ? "이번 판에 나올 수 있음" : "이번 판엔 안 나옴", r.desc, team + (pool.has(id) ? "" : " off"));
        dexBody.appendChild(card);
      }
    }
  } else if (dexTab === "items") {
    const r = catalog.rules.auction;
    dexBody.appendChild(make("p", "dex-note", "밤마다 " + r.lots + "건 · 건당 " + r.lotSeconds + "초 · 1인당 하룻밤 " + r.winLimit + "건 낙찰. 무엇이 팔렸는지는 공개, 누가 샀는지는 비공개."));
    for (const cat of [["hack", "해킹 (메신저에 작용)"], ["defense", "방어"], ["info", "정보·기타"]]) {
      dexBody.appendChild(make("h4", "log-day", cat[1]));
      for (const id in catalog.items) {
        const it = catalog.items[id];
        if (it.cat !== cat[0]) continue;
        dexBody.appendChild(dexCard(icon(id, "dex-ico"), it.name, "시작가 " + it.price + "만 · " + WHEN_KO[it.when], it.desc, "item " + it.cat));
      }
    }
  } else if (dexTab === "services") {
    dexBody.appendChild(make("p", "dex-note", "경매와 별개로 언제든 구매. 하룻밤 " + catalog.rules.serviceLimit + "건까지, 한 번 쓴 서비스는 다음부터 1.5배."));
    for (const id in catalog.services) {
      const sv = catalog.services[id];
      dexBody.appendChild(dexCard(icon(id, "dex-ico"), sv.name, "기본 " + sv.price + "만", sv.desc, "item"));
    }
  } else if (dexTab === "casino") {
    const c = catalog.rules.casino;
    dexBody.appendChild(make("p", "dex-note", "낮에만 열림 · 하루 " + c.playsPerDay + "판 · 판돈 " + c.minBet + " ~ " + c.maxBet + "만. 져도 판돈은 그대로 돌려받아요."));
    for (const id in catalog.casino) {
      const g = catalog.casino[id];
      dexBody.appendChild(dexCard(make("span", "dex-ico cg", GAME_ICONS[id] || "★"), g.name, null, g.odds, "item"));
    }
  } else {
    const rows = [
      ["하루 흐름", "1일차 낮 → 밤 → 아침(CCTV) → 낮 → 투표(2일차부터) → 밤 … 착륙일 투표가 끝나면 착륙."],
      ["낮", "카지노 · 그룹 채팅 · 송금. 낮이 시작될 때 수입 (VIP 30만, 나머지 10만)."],
      ["밤", "통행금지. 직업 능력 · 1:1 메신저 · 경매장 · 다크넷 · 송금."],
      ["투표", "최다 득표자는 비행선 밖으로. 동점이면 없음. 모두 투표하면 바로 마감."],
      ["체력", "VIP 3, 나머지 2. 부상이어도 능력·아이템은 그대로 사용 가능."],
      ["신디케이트", "밤마다 공격 투표 또는 특수 능력 중 하나. 표가 갈리면 50% 확률로만 공격."],
      ["보디가드", "막아내면 경호 보수 +" + catalog.rules.bodyguardReward + "만."],
      ["승리", "시민팀: 신디케이트 전멸 또는 착륙(" + catalog.rules.landingDays + "일차)까지 VIP 생존. 신디케이트: VIP 사망 또는 시민팀에 VIP 혼자 남음. 제3세력은 각자 조건."],
    ];
    for (const [t, d] of rows) dexBody.appendChild(dexCard(null, t, null, d, "rule"));
  }
}

document.querySelector("#dex-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-d]");
  if (!b) return;
  dexTab = b.dataset.d;
  for (const x of b.parentElement.children) x.classList.toggle("on", x === b);
  sound.play("tab");
  drawDex();
});
drawDex();
drawLog();

fillIcons(); // HTML에 적어둔 아이콘 자리 채우기
