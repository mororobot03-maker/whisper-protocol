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
const endSpeechBtn = document.querySelector("#end-speech-btn");
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
const shopState = document.querySelector("#shop-state");
const shopList = document.querySelector("#shop-list");
const darknetList = document.querySelector("#darknet-list");
const transferBtn = document.querySelector("#transfer-btn");
const betAmount = document.querySelector("#bet-amount");
const gambleList = document.querySelector("#gamble-list");
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
  updateMusic(); // 밤에 카지노 탭을 열면 카지노 음악
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
}

// 단계마다 보여줄 탭과 처음 열 탭
function setupTabs(data) {
  const night = data.phase === "night" && data.alive;
  const show = {
    chat: true,
    info: true,
    action: night,
    shop: night,
    darknet: night,
    bank: night,
    casino: night || !!data.canCasino, // 독대 대기실에서도 카지노
    vote: !!data.canVote,
    memo: true,
  };
  for (const btn of tabs.querySelectorAll("button")) btn.classList.toggle("hidden", !show[btn.dataset.tab]);

  openedApps.clear(); // 새 단계: 앱을 처음 열 때 연출이 다시 나옴
  if (night) setTab("action", true);
  else if (data.canVote) setTab("vote", true);
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
      const tag = role.noBan ? (id === "vip" ? "필수" : "기본") : banned ? "금지" : locked ? role.minPlayers + "인 이상" : "";
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

// 아이템별 아이콘 이름과 효과 시점 (화면 표시용)
const ITEM_TIMING = {
  proxy: "tonight", firewall: "tonight", armor: "tonight", decoy: "tonight", launder: "tonight",
  wiretap: "tomorrow", mask: "tomorrow", jammer: "tomorrow", bribe: "tomorrow",
  scanner: "inbox", translog: "inbox", deepfake: "inbox", miner: "multi",
};
const TIMING_LABEL = { tonight: "오늘 밤", tomorrow: "내일 낮", inbox: "아침에 결과", multi: "3턴 동안" };

// 고스트 대사: 매일 밤 하나씩 (꾸미기용)
const GHOST_LINES = [
  "오늘은 물건이 좀 귀하지.",
  "돈만 있으면 못 구할 게 없어.",
  "누가 뭘 샀는지는 나만 알지.",
  "빨리 골라. 순찰이 돌 시간이야.",
  "어젯밤 손님은 운이 없었지.",
  "이번 물건은 진짜야. 아마도.",
];
let ghostDay = -1;

// 대상을 고르는 작은 얼굴 목록 (상점, 다크넷 공용)
// picker = { kind: "shop"|"svc", id, step } : 지금 열려 있는 선택 칸
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

// ----- 암상인: 진열장 카드 -----
function drawShop(eco) {
  shopList.innerHTML = "";
  const app = document.querySelector(".app-shop");
  app.classList.toggle("open", eco.shop.open);
  shopState.textContent = eco.shop.open ? "영업 중" : "도착 전";

  for (const item of eco.shop.items) {
    const card = make("div", "item-card" + (item.sold ? " sold" : ""));
    const top = make("div", "item-top");
    top.appendChild(icon(item.id, "item-ico"));
    const timing = ITEM_TIMING[item.id];
    const t = make("span", "timing " + timing);
    t.title = TIMING_LABEL[timing];
    t.appendChild(icon(timing));
    top.appendChild(t);
    card.appendChild(top);
    card.appendChild(make("strong", "item-name", item.name));
    card.appendChild(make("small", "item-desc", item.desc));

    const foot = make("div", "item-foot");
    const price = make("span", "price");
    price.appendChild(icon("credit"));
    price.appendChild(document.createTextNode(item.price));
    foot.appendChild(price);
    const btn = make("button", "buy", item.sold ? "매진" : "구매");
    btn.type = "button";
    btn.dataset.item = item.id;
    btn.disabled = item.sold || !eco.shop.open || eco.credits < item.price;
    foot.appendChild(btn);
    card.appendChild(foot);

    if (item.sold) card.appendChild(make("span", "stamp", "SOLD OUT"));

    // 대상이 필요한 아이템: 구매를 누르면 카드 안에 얼굴 목록이 펼쳐짐
    if (picker && picker.kind === "shop" && picker.id === item.id && !item.sold) {
      card.classList.add("picking");
      if (item.target === "deepfake" && !picker.deepKind) {
        card.appendChild(make("small", "pick-label", "가짜 발표 문구"));
        const kinds = make("div", "pick-row");
        for (const k in eco.deepfakeTemplates) {
          const b = make("button", "pick", eco.deepfakeTemplates[k]);
          b.type = "button";
          b.addEventListener("click", () => { picker.deepKind = k; drawShop(lastEco); });
          kinds.appendChild(b);
        }
        card.appendChild(kinds);
      } else {
        card.appendChild(make("small", "pick-label", "대상 선택"));
        const names = item.target === "deepfake" ? eco.everyone : eco.players;
        card.appendChild(peoplePicker(names, (name) => {
          socket.emit("buy", { item: item.id, target: name, kind: picker.deepKind || null });
          picker = null;
          drawShop(lastEco);
        }));
      }
    }
    shopList.appendChild(card);
  }
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
  for (const s of eco.services) {
    const card = make("div", "svc" + (s.waitDays > 0 ? " locked" : ""));
    card.appendChild(icon(s.id, "svc-ico"));
    const body = make("div", "svc-body");
    body.appendChild(make("strong", null, s.name.replace("인포브로커 · ", "")));
    body.appendChild(make("small", null, s.desc));
    card.appendChild(body);

    const side = make("div", "svc-side");
    const price = make("span", "price");
    price.appendChild(icon("credit"));
    price.appendChild(document.createTextNode(s.price));
    side.appendChild(price);
    const btn = make("button", "run");
    btn.type = "button";
    btn.dataset.service = s.id;
    if (s.waitDays > 0) {
      btn.appendChild(icon("lock"));
      btn.appendChild(document.createTextNode(s.waitDays + "일"));
    } else {
      btn.textContent = "실행";
    }
    btn.disabled = s.waitDays > 0 || eco.credits < s.price;
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
  transferBtn.disabled = !bank.to || n < 1 || n > myCredits;
  transferBtn.textContent = bank.to && n > 0 ? bank.to + "에게 " + n + "만 보내기" : "보내기";
}

// ----- 카지노: 칩 -----
let bet = 10;

// 올인이거나 가진 돈보다 큰 칩이면 가진 돈만큼만
function betValue() {
  return bet === "all" ? myCredits : Math.min(bet, myCredits);
}

function drawBet() {
  document.querySelector("#bet-view").textContent = betValue();
  betAmount.value = betValue();
  for (const c of document.querySelectorAll(".chip")) {
    c.classList.toggle("on", String(c.dataset.bet) === String(bet) && (bet === "all" || bet <= myCredits));
    c.disabled = c.dataset.bet !== "all" && Number(c.dataset.bet) > myCredits;
  }
}

function drawEconomy(eco) {
  lastEco = eco;
  myCredits = eco.credits;
  drawShop(eco);
  drawDarknet(eco);
  drawBank(eco);

  if (ghostDay !== currentDay) {
    ghostDay = currentDay;
    document.querySelector("#ghost-line").textContent = "“" + GHOST_LINES[Math.floor(Math.random() * GHOST_LINES.length)] + "”";
  }

  gambleList.innerHTML = "";
  for (const g of eco.gambles) {
    const btn = make("button", "game-btn " + g.id);
    btn.type = "button";
    btn.dataset.kind = g.id;
    btn.appendChild(make("strong", null, g.id === "double" ? "룰렛" : "슬롯머신"));
    btn.appendChild(make("small", null, "당첨 " + Math.round(g.chance * 100) + "% · " + g.payout + "배"));
    gambleList.appendChild(btn);
  }
  drawBet();
  if (eco.mine) drawMine(eco.mine);
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

// 상점 구매: 대상이 필요 없으면 바로 구매, 필요하면 카드 안에 얼굴 목록을 펼침
shopList.addEventListener("click", (e) => {
  const btn = e.target.closest("button.buy");
  if (!btn || btn.disabled) return;
  const item = lastEco.shop.items.find((i) => i.id === btn.dataset.item);
  if (item.target === "none") return socket.emit("buy", { item: item.id });
  picker = picker && picker.id === item.id ? null : { kind: "shop", id: item.id }; // 다시 누르면 닫힘
  drawShop(lastEco);
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

// 카지노: 칩으로 베팅액 고르기
document.querySelector("#chips").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c || c.disabled) return;
  bet = c.dataset.bet === "all" ? "all" : Number(c.dataset.bet);
  drawBet();
});

gambleList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || spinning) return; // 돌아가는 중에는 다시 못 누름
  startSpin(btn.dataset.kind); // 서버 응답을 기다리는 동안 바로 돌기 시작
  socket.emit("gamble", { kind: btn.dataset.kind, amount: betValue() });
});

meRole.addEventListener("click", () => setTab("info"));
endSpeechBtn.addEventListener("click", () => socket.emit("endSpeech"));

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
    const li = make("li");
    li.appendChild(nameTag(p.name));
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
// 도박 애니메이션 중에는 결과가 미리 보이지 않도록 잠깐 보류했다가 반영
let pendingStatus = null;
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
  if (lastEco) drawBet();
}

function flashHurt() {
  const v = document.querySelector("#hurt-vignette");
  v.classList.remove("show");
  v.getBoundingClientRect();
  v.classList.add("show");
}
socket.on("status", (s) => {
  if (spinning) pendingStatus = s;
  else drawStatus(s);
});

socket.on("gambleResult", async (res) => {
  await stopSpin(res);
  if (!res.error) addLine("◆ " + res.name + ": " + (res.win ? "당첨! +" : "꽝. ") + res.delta + "만", "system econ");
  if (pendingStatus) drawStatus(pendingStatus);
  pendingStatus = null;
});

let shopWasOpen = false;
socket.on("economy", (eco) => {
  drawEconomy(eco);
  // 암상인이 막 도착했으면 탭에 빨간 점 + 짧은 방송
  if (eco.shop.open && !shopWasOpen) {
    if (!isVisible("shop")) setDot("shop", true);
    toast("화물칸 해치가 열렸습니다. 암상인이 도착했습니다.");
  }
  shopWasOpen = eco.shop.open;
});
socket.on("econMsg", (text) => {
  addLine("◆ " + text, "system econ");
  if (text.includes("구매 완료")) ghostFace("smile");
  else if (text.includes("먼저 가져갔다")) {
    ghostFace("wary");
    sound.play("sold");
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
  const key = data.phase === "talk" ? data.title : data.phase + data.day; // 독대는 라운드마다
  if (key === lastCardKey) return false;
  lastCardKey = key;

  if (data.phase === "night") {
    showPhaseCard(data.day + "일차 밤", data.alive ? "능력 · 암상인 · 카지노" : "관전 중", "night");
  } else if (data.phase === "morning") {
    showPhaseCard(data.day + "일차 아침", "선내 방송", "morning");
  } else if (data.phase === "talk") {
    const sub = !data.alive ? "관전 중" : data.partner ? "상대: " + data.partner : "이번 라운드는 대기실";
    showPhaseCard(data.title, sub, "talk");
  } else if (data.phase === "speech") {
    showPhaseCard("공개 발언", "한 명씩 차례로 모두에게", "speech");
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
  const PHASE_ICONS = { intro: "ship", night: "moon", morning: "sun", talk: "talk", speech: "megaphone", vote: "ballot", result: "ballot", over: "ship" };
  phaseIcon.innerHTML = "";
  phaseIcon.appendChild(icon(PHASE_ICONS[data.phase] || "ship"));
  picker = null; // 단계가 바뀌면 펼쳐둔 선택 칸 닫기
  screens.game.dataset.phase = data.phase; // CSS에서 밤/낮 분위기 바꾸는 용도
  startTimer(data.seconds);

  resetMineUI(); // 단계가 바뀌면 풀던 채굴 문제는 무효
  drawPrivate(data.private);
  drawAction(data.phase === "night" ? data.action : null);
  setupTabs(data);

  // 나만 보는 결과는 "내 정보" 탭에도 날짜별로 쌓아둠
  for (const line of data.private || []) {
    intelLog.appendChild(make("li", null, data.day + "일차 · " + line));
    if (!isVisible("info")) setDot("info", true);
  }
  drawVote(data);
  phaseInfo.textContent = data.info || "";

  // 채팅 칸: 말할 수 있는 단계에서만 열림
  chatInput.disabled = !data.canChat;
  sendBtn.disabled = !data.canChat; // 말할 수 없을 땐 전송 버튼도 회색
  chatInput.placeholder = data.canChat ? "메시지 입력" : "지금은 말할 수 없습니다";
  if (data.canChat) chatInput.focus();

  endSpeechBtn.classList.toggle("hidden", !data.isSpeaker);

  // ----- 연출 -----
  if (data.phase === "intro") showIntro(data.shipName);
  else hideIntro();

  // 단계가 바뀌는 순간 타이틀 카드 (같은 단계 안에서 발언자만 바뀔 땐 생략)
  const cardShown = phaseCard(data);
  const PHASE_SFX = { night: "night", morning: "morning", speech: "speech", vote: "vote" };
  if (cardShown && PHASE_SFX[data.phase]) sound.play(PHASE_SFX[data.phase]);

  // 독대 시간: 밀담 부스 화면 (문 닫힘 → 열림) / 사망자는 관전
  showBooth(data);

  // 공개 발언·투표·결과: 채팅 위에 원형 지도
  if (data.phase === "speech") {
    showStage("speech", {
      title: "공개 발언 · " + (data.speaker || ""),
      hint: data.isSpeaker ? "내 차례! 아래 입력창에 말하면 지도에 말풍선으로 떠요" : "발언자의 말이 지도 위에 떠요",
      speaker: data.speaker,
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

const CHANNEL_TAG = { syndicate: "[암호화] ", speech: "[발언] ", booth: "", wiretap: "[도청] ", spectate: "[관전] " };

socket.on("chat", (msg) => {
  const mine = msg.fromId === socket.id;
  // [채널] (토큰)이름: 내용  — 이름은 그 사람의 고유 색
  const line = document.createDocumentFragment();
  if (CHANNEL_TAG[msg.channel]) line.appendChild(make("span", "tag", CHANNEL_TAG[msg.channel]));
  if (mine) line.appendChild(make("span", "name", "나"));
  else line.appendChild(nameTag(msg.from, true));
  line.appendChild(make("span", "text", ": " + msg.text));
  addLine(line, (mine ? "me" : "them") + " " + msg.channel);

  if (msg.channel === "booth") boothSay(mine, msg.text); // 부스 화면 말풍선
  if (msg.channel === "speech") mapSay(msg.from, msg.text); // 공개 발언: 지도 위 말풍선
  if (msg.channel === "spectate") spectateSay(msg.from, msg.text);
  sound.play(msg.channel === "wiretap" ? "whisper" : mine ? "msgOut" : "msgIn");
});

// ----- 밀담 부스: 대화 종료 -----
document.querySelector("#booth-leave").addEventListener("click", () => {
  if (pressLeaveBtn()) socket.emit("leaveBooth");
});
document.querySelector("#booth-badges").addEventListener("click", (e) => {
  const pick = e.target.closest(".spec-pick");
  if (pick) {
    sound.play("tab");
    return socket.emit("spectateBooth", Number(pick.dataset.no));
  }
  if (e.target.closest(".go-casino")) {
    sound.play("tab");
    setTab("casino");
  }
});
// ----- 사망자 관전 -----
socket.on("spectateLog", (info) => {
  enterSpectate(info);
  addLine("── 밀담 부스 #" + info.no + " 엿보기 (" + info.names.join(" ↔ ") + ") ──", "divider");
  if (!info.msgs.length) addLine("아직 아무 말도 없었습니다.", "system");
  for (const m of info.msgs) {
    const line = document.createDocumentFragment();
    line.appendChild(make("span", "tag", "[관전] "));
    line.appendChild(nameTag(m.from, true));
    line.appendChild(make("span", "text", ": " + m.text));
    addLine(line, "them spectate");
  }
});
socket.on("spectateEnded", ({ by }) => {
  addLine("[관전] " + by + " 님이 대화를 끝냈습니다.", "system");
  if (spectating) endBooth(by + " 님이 대화를 끝냈습니다");
});

socket.on("boothEnded", ({ byMe, by }) => {
  phaseInfo.textContent = "대화가 끝났습니다. 남은 시간은 카지노에서 보낼 수 있습니다.";
  addLine(byMe ? "대화를 끝냈습니다." : by + " 님이 대화를 끝냈습니다.", "system");
  chatInput.disabled = true;
  sendBtn.disabled = true;
  chatInput.placeholder = "대화가 끝났습니다";
  endBooth(byMe ? "내가 대화를 끝냈습니다" : by + " 님이 대화를 끝냈습니다");
  sound.play("door");
  // 카지노 탭 열어 주기
  tabs.querySelector('[data-tab="casino"]').classList.remove("hidden");
  setDot("casino", true);
});

socket.on("partnerLeft", (name) => {
  addLine(name + " 님이 연결을 끊었습니다.", "system");
  if (!boothUI.el.classList.contains("hidden")) fillSeat(boothUI.them, null, "empty", name + " · 연결 끊김");
});

socket.on("errorMsg", (msg) => {
  sound.play("error");
  errorEl.textContent = msg;
  document.querySelector("#result-note").textContent = msg; // 결과 화면에서 재시작이 안 될 때 이유 표시
});

// =====================================================
//  채굴 미션 (카지노 아래)
//  서버가 문제를 보내면 → 화면에 판을 그리고 → 고른 답을 서버로 → 서버가 채점
// =====================================================
const mine = {
  btn: document.querySelector("#mine-btn"),
  left: document.querySelector("#mine-left"),
  desc: document.querySelector("#mine-desc"),
  target: document.querySelector("#mine-target"),
  board: document.querySelector("#mine-board"),
  bar: document.querySelector("#mine-bar"),
  info: { done: 0, total: 5, next: 2 },
  active: null, // 지금 풀고 있는 문제
  lockTimer: null,
  timeTimer: null,
};

function drawMine(info) {
  if (info) mine.info = info;
  const { done, total, next } = mine.info;
  mine.left.textContent = "미션 " + done + " / " + total;
  if (mine.active) return;
  const finished = done >= total;
  mine.btn.disabled = finished || !!mine.lockTimer;
  if (!mine.lockTimer) mine.btn.textContent = finished ? "이번 시간 채굴 완료" : "채굴 시작 · +" + next + "만";
}

function resetMineUI() {
  clearTimeout(mine.timeTimer);
  mine.active = null;
  mine.board.innerHTML = "";
  mine.board.className = "mine-board";
  mine.target.classList.add("hidden");
  mine.bar.style.transition = "none";
  mine.bar.style.width = "0%";
  mine.desc.textContent = "미션을 깨면 크레딧이 들어옵니다. 틀리면 5초 과열.";
  drawMine();
}

mine.btn.addEventListener("click", () => {
  if (mine.active || mine.btn.disabled) return;
  sound.play("type");
  socket.emit("mineStart");
});

socket.on("mineChallenge", (c) => {
  mine.active = { ...c, picks: [] };
  mine.btn.disabled = true;
  mine.btn.textContent = "채굴 중... +" + c.reward + "만";
  mine.board.innerHTML = "";
  mine.board.className = "mine-board " + c.type;
  mine.target.classList.remove("hidden");
  if (c.type === "hash") {
    mine.desc.textContent = "미션 " + c.mission + " · 아래 해시 중 이 글자로 시작하는 것을 찾아라";
    mine.target.textContent = c.target + "▒▒▒";
  } else {
    mine.desc.textContent = "미션 " + c.mission + " · 블록을 1부터 순서대로 연결하라";
    mine.target.textContent = "1 → " + c.cells.length;
  }
  c.cells.forEach((v, i) => {
    const b = make("button", "mine-cell", String(v));
    b.type = "button";
    b.dataset.i = i;
    mine.board.appendChild(b);
  });
  // 남은 시간 막대
  mine.bar.style.transition = "none";
  mine.bar.style.width = "100%";
  mine.bar.getBoundingClientRect();
  mine.bar.style.transition = "width " + c.seconds + "s linear";
  mine.bar.style.width = "0%";
  clearTimeout(mine.timeTimer);
  mine.timeTimer = setTimeout(() => submitMine(-1), c.seconds * 1000); // 시간 초과
});

function submitMine(answer) {
  if (!mine.active) return;
  clearTimeout(mine.timeTimer);
  mine.active = null;
  mine.bar.style.transition = "none";
  socket.emit("mineAnswer", { answer });
}

mine.board.addEventListener("click", (e) => {
  const cell = e.target.closest(".mine-cell");
  const c = mine.active;
  if (!cell || !c || cell.disabled) return;
  const i = Number(cell.dataset.i);
  if (c.type === "hash") {
    cell.classList.add("picked");
    return submitMine(i);
  }
  // 블록 순서: 맞으면 불이 켜지고, 틀리면 바로 제출(실패)
  const want = c.picks.length + 1;
  c.picks.push(i);
  if (c.cells[i] !== want) {
    cell.classList.add("wrong");
    return submitMine(c.picks);
  }
  cell.classList.add("linked");
  cell.disabled = true;
  sound.play("click");
  if (c.picks.length === c.cells.length) submitMine(c.picks);
});

socket.on("mineResult", (r) => {
  if (r.error) {
    mine.desc.textContent = r.error;
    sound.play("error");
    return drawMine();
  }
  mine.target.classList.add("hidden");
  if (r.ok) {
    mine.desc.textContent = "블록 채굴 성공! +" + r.delta + "만";
    mine.board.classList.add("success");
    sound.play("win");
  } else {
    mine.desc.textContent = (r.timeout ? "시간 초과! " : "해시 불일치! ") + "장비 과열 " + r.lock + "초";
    mine.board.classList.add("fail");
    sound.play("lose");
    // 과열 카운트다운
    let left = r.lock;
    mine.btn.disabled = true;
    mine.btn.textContent = "과열 " + left + "초";
    clearInterval(mine.lockTimer);
    mine.lockTimer = setInterval(() => {
      left--;
      mine.btn.textContent = "과열 " + left + "초";
      if (left <= 0) {
        clearInterval(mine.lockTimer);
        mine.lockTimer = null;
        drawMine();
      }
    }, 1000);
  }
  drawMine();
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
const PHASE_MUSIC = { intro: "lobby", night: "night", morning: null, talk: "talk", speech: "vote", vote: "vote", result: "vote", over: null };
function updateMusic() {
  if (screens.game.classList.contains("hidden")) return sound.music("lobby"); // 입장·로비
  const phase = screens.game.dataset.phase;
  if ((phase === "night" || phase === "talk") && currentTab === "casino") return sound.music("casino");
  sound.music(PHASE_MUSIC[phase] ?? null);
}
updateMusic();

fillIcons(); // HTML에 적어둔 아이콘 자리 채우기
