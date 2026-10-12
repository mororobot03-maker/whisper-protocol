// =====================================================
//  위스퍼 프로토콜 - 픽셀 캐릭터 (avatar.js)
//  - 32×32 칸에 한 칸씩 색을 찍어서 그림
//  - 그리는 순서
//      1) 윤곽 층: 몸, 모자/귀, 목 장식  → 바깥에 굵은 검은 테두리를 자동으로 두름
//      2) 얼굴 층: 그림자, 얼굴 장식, 눈, 입, 떠 있는 장식
//  - 같은 조합은 한 번만 그리고 결과 그림을 기억해서 재사용 (채팅 줄이 많아도 가벼움)
//  ※ 각 목록의 개수는 server.js 의 AVATAR_LIMITS 와 같아야 함
// =====================================================

const AV = 32;
const INK = [16, 14, 24]; // 테두리, 눈, 입에 쓰는 거의 검은색

// ----- 선택지 목록 (이름은 꾸미기 화면에 표시) -----
const AVATAR_PARTS = {
  body: [
    { name: "주황", hex: "#ff8a5c" }, { name: "연두", hex: "#7ee081" }, { name: "하늘", hex: "#5cb8ff" },
    { name: "보라", hex: "#c38cff" }, { name: "레몬", hex: "#ffe07a" }, { name: "분홍", hex: "#ff8fc8" },
    { name: "민트", hex: "#4fe3d0" }, { name: "라벤더", hex: "#a3b4ff" }, { name: "모래", hex: "#e6b07a" },
    { name: "하양", hex: "#eef0f6" }, { name: "회색", hex: "#9aa3b5" }, { name: "밤색", hex: "#8a5a44" },
  ],
  top: ["없음", "실크햇", "토끼 귀", "LED 고양이 귀", "안테나", "모히칸", "헤드폰", "비니", "후드", "페도라", "홀로그램 링", "데이터 케이블"],
  topColor: [
    { name: "검정", hex: "#2b2b3a" }, { name: "하양", hex: "#f2f2f2" }, { name: "금색", hex: "#f5c451" }, { name: "네온 핑크", hex: "#ff4fa3" },
  ],
  eyes: ["점눈", "졸린 눈", "날카로운 눈", "반짝 별눈", "윙크", "바이저", "모노클", "하트 눈", "고양이 눈", "선글라스", "글리치 눈", "세 번째 눈"],
  mouth: ["미소", "무표정", "이빨 씩", "메롱", "놀란 입", "긴장", "마스크", "금니 씩", "콧수염", "스피커 그릴"],
  deco: ["없음", "볼 회로선", "홍조", "주근깨", "바코드", "네온 페인트", "피어싱", "금속 판"],
  neck: ["없음", "나비넥타이", "넥타이", "스카프", "체인 목걸이", "카지노 칩"],
};

// 모자 색을 고를 수 있는 머리 위 장식 (나머지는 색이 정해져 있음)
const TOP_USES_COLOR = new Set([1, 2, 5, 7, 8, 9]);

const AVATAR_KEYS = ["body", "top", "topColor", "eyes", "mouth", "deco", "neck"];

function defaultAvatar() {
  return { body: 0, top: 0, topColor: 0, eyes: 0, mouth: 0, deco: 0, neck: 0 };
}

function randomAvatar() {
  const a = {};
  for (const k of AVATAR_KEYS) a[k] = Math.floor(Math.random() * AVATAR_PARTS[k].length);
  return a;
}

// 잘못된 값이 들어와도 그림이 깨지지 않도록 범위 안으로
function cleanAvatar(a) {
  const out = defaultAvatar();
  if (!a || typeof a !== "object") return out;
  for (const k of AVATAR_KEYS) {
    const n = Number(a[k]);
    if (Number.isInteger(n) && n >= 0 && n < AVATAR_PARTS[k].length) out[k] = n;
  }
  return out;
}

// ----- 색 도우미 -----
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(rgb, f) {
  // f < 0 이면 어둡게, f > 0 이면 밝게
  return rgb.map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
}

// =====================================================
//  그리기
// =====================================================
function drawAvatar(a) {
  a = cleanAvatar(a);
  const buf = new Uint8ClampedArray(AV * AV * 4);
  const bodyMask = new Uint8Array(AV * AV); // 몸이 있는 칸
  const partMask = new Uint8Array(AV * AV); // 몸 위에 장식(모자 챙, 목 장식 등)이 덮은 칸
  let marking = false; // 몸을 그린 뒤부터 장식 칸을 표시

  const inside = (x, y) => x >= 0 && y >= 0 && x < AV && y < AV;
  const px = (x, y, c, alpha = 255) => {
    x = Math.round(x);
    y = Math.round(y);
    if (!inside(x, y)) return;
    const i = (y * AV + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = alpha;
    if (marking) partMask[y * AV + x] = 1;
  };
  const filled = (x, y) => inside(x, y) && buf[(y * AV + x) * 4 + 3] > 0;
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  const disc = (cx, cy, r, c, onPixel) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6) { px(x, y, c); if (onPixel) onPixel(x, y); }
  };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  };
  // 문자 그림: "#"=색1, "o"=색2, "w"=흰색, "k"=먹색, "."=빈칸
  const sprite = (x, y, rows, colors) => {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (colors[ch]) px(x + i, y + j, colors[ch]); }));
  };
  // 얼굴 위에만 찍기 (몸 바깥으로 삐져나가지 않게)
  const face = (x, y, c) => { if (inside(x, y) && bodyMask[y * AV + x] && !partMask[y * AV + x]) px(x, y, c); };
  const faceRect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) face(x + i, y + j, c); };

  const body = hexRgb(AVATAR_PARTS.body[a.body].hex);
  const hat = hexRgb(AVATAR_PARTS.topColor[a.topColor].hex);
  const W = [255, 255, 255];
  const PINK = hexRgb("#ff4fa3");
  const MAG = hexRgb("#ff2fd1");
  const GOLD = hexRgb("#f5c451");
  const STEEL = hexRgb("#9aa3b5");
  const DARK = hexRgb("#2b2b3a");
  const CX = 16, CY = 19, R = 10; // 몸 중심과 반지름

  // ===== 1) 윤곽 층 =====
  // 후드는 몸 뒤에
  if (a.top === 8) {
    disc(CX, CY - 1, R + 2.2, hat);
    sprite(13, 4, ["..##..", ".####.", "######"], { "#": hat });
  }
  // 토끼 귀, 고양이 귀, 안테나는 몸 뒤에서 솟아오름
  if (a.top === 2) {
    const ear = (x) => { rect(x, 1, 4, 9, hat); rect(x + 1, 0, 2, 1, hat); rect(x + 1, 2, 2, 6, PINK); };
    ear(9); ear(19);
  }
  if (a.top === 3) {
    sprite(6, 5, ["#.....", "##....", "###...", "####..", "#####.", "######"], { "#": DARK });
    sprite(20, 5, [".....#", "....##", "...###", "..####", ".#####", "######"], { "#": DARK });
    px(8, 8, MAG); px(8, 9, MAG); px(9, 9, MAG); px(23, 8, MAG); px(23, 9, MAG); px(22, 9, MAG);
  }
  if (a.top === 4) {
    line(12, 10, 9, 3, DARK); line(20, 10, 23, 3, DARK);
    disc(8.5, 2.5, 1.4, MAG); disc(23.5, 2.5, 1.4, MAG);
  }
  if (a.top === 11) {
    // 데이터 케이블: 머리에서 뒤로 늘어진 선 + 플러그
    line(10, 11, 6, 7, DARK); line(6, 7, 5, 3, DARK); line(11, 11, 7, 7, DARK); line(7, 7, 6, 3, DARK);
    rect(4, 0, 3, 3, STEEL); px(5, 0, GOLD);
  }

  // 몸 (둥근 캐릭터)
  disc(CX, CY, R, body, (x, y) => (bodyMask[y * AV + x] = 1));
  marking = true;

  // 머리 위 장식
  if (a.top === 1) { // 실크햇
    rect(11, 0, 11, 8, hat);
    rect(11, 6, 11, 1, MAG); // 띠
    rect(7, 8, 19, 2, hat);  // 챙
    rect(12, 1, 1, 5, shade(hat, 0.35)); // 광택
  }
  if (a.top === 5) { // 모히칸
    sprite(13, 3, [".#.#.#.", "#######", "#######", "#######", "#######", "#######", ".#####."], { "#": hat });
  }
  if (a.top === 6) { // 헤드폰
    for (let x = 8; x <= 24; x++) {
      const y = Math.round(9 - Math.sqrt(Math.max(0, 64 - (x - 16) ** 2)) * 0.6);
      px(x, y, DARK); px(x, y + 1, DARK);
    }
    rect(4, 15, 4, 7, DARK); rect(25, 15, 4, 7, DARK);
    rect(5, 16, 2, 5, MAG); rect(26, 16, 2, 5, MAG);
  }
  if (a.top === 7) { // 비니
    for (let y = 5; y <= 13; y++) for (let x = 6; x <= 26; x++)
      if ((x - CX) ** 2 / 110 + (y - 13.5) ** 2 / 72 <= 1) px(x, y, hat);
    rect(6, 12, 21, 2, shade(hat, -0.25));
    disc(16, 4, 1.6, shade(hat, 0.3));
  }
  if (a.top === 9) { // 페도라
    rect(4, 10, 25, 2, hat);
    rect(10, 4, 13, 6, hat);
    rect(14, 4, 5, 1, shade(hat, -0.3)); // 움푹한 곳
    rect(10, 8, 13, 1, MAG);
  }
  if (a.top === 8) { // 후드 얼굴 구멍 테두리
    for (let y = 0; y < AV; y++) for (let x = 0; x < AV; x++) {
      const d = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2);
      if (bodyMask[y * AV + x] && d > R - 1.2 && y < CY + 3) px(x, y, hat);
    }
  }

  // 목 장식
  if (a.neck === 1) { // 나비넥타이
    sprite(11, 24, ["##...##", "###.###", "#######", "###.###", "##...##"], { "#": MAG });
    rect(14, 25, 3, 3, shade(MAG, -0.4));
  }
  if (a.neck === 2) { // 넥타이
    rect(15, 24, 3, 2, DARK);
    sprite(14, 26, [".###.", "#####", "#####", "#####", ".###."], { "#": DARK });
    px(16, 27, MAG); px(16, 28, MAG);
  }
  if (a.neck === 3) { // 스카프
    const SC = hexRgb("#8a5cff");
    for (let x = 8; x <= 24; x++) { px(x, 25, SC); px(x, 26, SC); px(x, 27, shade(SC, -0.25)); }
    rect(19, 28, 3, 3, SC);
  }
  if (a.neck === 4) { // 체인 목걸이
    for (let x = 9; x <= 23; x += 2) { const y = 25 + (Math.abs(x - 16) < 4 ? 1 : 0); px(x, y, GOLD); px(x + 1, y, shade(GOLD, -0.4)); }
  }
  if (a.neck === 5) { // 카지노 칩
    for (let x = 10; x <= 22; x += 2) { const y = 24 + (Math.abs(x - 16) < 4 ? 1 : 0); px(x, y, GOLD); px(x + 1, y, shade(GOLD, -0.4)); }
    disc(16, 27.5, 2.2, hexRgb("#b0123a"));
    px(16, 26, W); px(14, 28, W); px(18, 28, W); px(16, 27, GOLD);
  }

  // ===== 굵은 검은 테두리 (2칸): 빈칸 중 채워진 칸 옆이면 검게 =====
  for (let pass = 0; pass < 2; pass++) {
    const edge = [];
    for (let y = 0; y < AV; y++) for (let x = 0; x < AV; x++) {
      if (filled(x, y)) continue;
      const near = pass === 0
        ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
        : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      if (near.some(([dx, dy]) => filled(x + dx, y + dy))) edge.push([x, y]);
    }
    for (const [x, y] of edge) px(x, y, INK);
  }

  // ===== 2) 얼굴 층 =====
  marking = false;
  // 그림자(오른쪽 아래)와 빛(왼쪽 위)
  const dark = shade(body, -0.22);
  for (let y = 0; y < AV; y++) for (let x = 0; x < AV; x++) {
    if (!bodyMask[y * AV + x] || partMask[y * AV + x]) continue;
    if ((x - CX) * 0.7 + (y - CY) > 6.5) px(x, y, dark);
  }
  faceRect(10, 12, 2, 2, shade(body, 0.55)); face(12, 12, shade(body, 0.35));

  // 얼굴 장식 (눈, 입보다 먼저)
  if (a.deco === 1) { [[7, 21], [8, 21], [9, 21], [10, 21], [10, 22], [10, 23]].forEach(([x, y]) => face(x, y, MAG)); face(11, 23, W); }
  if (a.deco === 2) { faceRect(8, 21, 3, 1, PINK); faceRect(21, 21, 3, 1, PINK); }
  if (a.deco === 3) { [[9, 20], [11, 21], [9, 22], [22, 20], [20, 21], [22, 22]].forEach(([x, y]) => face(x, y, shade(body, -0.45))); }
  if (a.deco === 4) { [21, 23, 24].forEach((x) => faceRect(x, 20, 1, 3, INK)); }
  if (a.deco === 5) { faceRect(10, 20, 3, 1, MAG); faceRect(19, 20, 3, 1, MAG); }
  if (a.deco === 6) { face(22, 15, GOLD); face(23, 16, GOLD); face(17, 22, GOLD); }
  if (a.deco === 7) {
    for (let y = 9; y < 30; y++) for (let x = 17; x < 30; x++) face(x, y, STEEL);
    for (let y = 9; y < 30; y++) face(17, y, shade(STEEL, -0.35));
    face(24, 14, DARK); face(25, 24, DARK); face(20, 26, DARK);
  }

  // 눈
  const eyeL = 11, eyeR = 19, eyeY = 16;
  const dot = (x) => { faceRect(x, eyeY, 2, 3, INK); face(x, eyeY, W); };
  switch (a.eyes) {
    case 0: dot(eyeL); dot(eyeR); break;
    case 1: faceRect(eyeL - 1, eyeY + 2, 4, 1, INK); faceRect(eyeR - 1, eyeY + 2, 4, 1, INK); break;
    case 2:
      dot(eyeL); dot(eyeR);
      line(eyeL - 1, eyeY - 2, eyeL + 2, eyeY - 1, INK); line(eyeR - 1, eyeY - 1, eyeR + 2, eyeY - 2, INK);
      break;
    case 3: {
      const st = (x) => { sprite(x - 1, eyeY - 1, [".y.", "yyy", ".y."], { y: hexRgb("#fff6a0") }); face(x, eyeY, W); };
      st(eyeL + 1); st(eyeR + 1); break;
    }
    case 4: dot(eyeL); sprite(eyeR - 1, eyeY, [".k.", "k.k"], { k: INK }); break;
    case 5:
      faceRect(7, eyeY - 1, 19, 4, INK);
      faceRect(8, eyeY + 1, 17, 1, MAG);
      face(9, eyeY, W);
      break;
    case 6:
      dot(eyeL);
      sprite(eyeR - 2, eyeY - 2, [".ggg.", "g...g", "g.k.g", "g...g", ".ggg."], { g: GOLD, k: INK });
      line(eyeR + 2, eyeY + 3, eyeR + 3, eyeY + 7, GOLD);
      break;
    case 7: {
      const ht = (x) => sprite(x - 1, eyeY, ["p.p", "ppp", ".p."], { p: PINK });
      ht(eyeL + 1); ht(eyeR + 1); break;
    }
    case 8: {
      const ce = (x) => { sprite(x - 1, eyeY - 1, ["yyy", "yky", "yky", "yyy"], { y: hexRgb("#ffe07a"), k: INK }); };
      ce(eyeL + 1); ce(eyeR + 1); break;
    }
    case 9:
      faceRect(eyeL - 2, eyeY - 1, 5, 3, INK); faceRect(eyeR - 1, eyeY - 1, 5, 3, INK);
      faceRect(eyeL + 3, eyeY - 1, 3, 1, INK);
      face(eyeL - 1, eyeY - 1, W); face(eyeR, eyeY - 1, W);
      break;
    case 10:
      dot(eyeL); dot(eyeR);
      face(eyeL - 1, eyeY + 1, MAG); face(eyeR + 2, eyeY, hexRgb("#2ff4ff")); face(eyeL + 2, eyeY + 2, hexRgb("#2ff4ff")); face(eyeR - 1, eyeY + 2, MAG);
      break;
    case 11:
      dot(eyeL); dot(eyeR);
      sprite(14, 10, [".kkk.", "kmmmk", ".kkk."], { k: INK, m: MAG });
      break;
  }

  // 입
  const my = 23;
  switch (a.mouth) {
    case 0: sprite(13, my, ["k....k", ".kkkk."], { k: INK }); break;
    case 1: faceRect(13, my + 1, 6, 1, INK); break;
    case 2: sprite(12, my - 1, ["kkkkkkkk", "kwwkwwwk", "kkkkkkkk"], { k: INK, w: W }); break;
    case 3: sprite(13, my, ["k....k", ".kkkk.", "..pp..", "..pp.."], { k: INK, p: PINK }); break;
    case 4: sprite(14, my - 1, [".kk.", "k..k", "k..k", ".kk."], { k: INK }); break;
    case 5: sprite(12, my, [".k.k.k.k", "k.k.k.k."], { k: INK }); break;
    case 6:
      for (let y = 21; y <= 28; y++) for (let x = 7; x <= 25; x++) face(x, y, DARK);
      faceRect(9, 23, 15, 1, shade(DARK, 0.25)); faceRect(9, 25, 15, 1, shade(DARK, 0.25));
      break;
    case 7: sprite(12, my - 1, ["kkkkkkkk", "kwwgwwwk", "kkkkkkkk"], { k: INK, w: W, g: GOLD }); break;
    case 8:
      sprite(10, my - 2, ["kk......kk", "kkkk..kkkk", ".kkkkkkkk."], { k: INK });
      faceRect(15, my + 2, 2, 1, INK);
      break;
    case 9:
      faceRect(12, my - 1, 8, 4, INK);
      faceRect(13, my, 6, 1, STEEL); faceRect(13, my + 2, 6, 1, STEEL);
      break;
  }

  // 떠 있는 장식은 테두리 없이 맨 위에 (홀로그램 링)
  if (a.top === 10) {
    for (let x = 9; x <= 23; x++) {
      const t = (x - 16) / 7;
      const dy = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * 1.6);
      px(x, 4 - dy, MAG, 230); px(x, 4 + dy, MAG, 230);
    }
  }

  return buf;
}

// 그림 → 이미지 주소 (같은 조합은 다시 그리지 않음)
const avatarCache = new Map();
function avatarURL(a) {
  a = cleanAvatar(a);
  const key = AVATAR_KEYS.map((k) => a[k]).join("-");
  if (avatarCache.has(key)) return avatarCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = AV;
  canvas.height = AV;
  canvas.getContext("2d").putImageData(new ImageData(drawAvatar(a), AV, AV), 0, 0);
  const url = canvas.toDataURL("image/png");
  avatarCache.set(key, url);
  return url;
}

// <img> 만들기. 픽셀이 흐려지지 않게 확대
function avatarImg(a, className) {
  const img = document.createElement("img");
  img.src = avatarURL(a);
  img.alt = "";
  img.className = "avatar" + (className ? " " + className : "");
  img.draggable = false;
  return img;
}
