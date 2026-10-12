// =====================================================
//  효과음 (8비트 스타일)
//  소리 파일 없이 브라우저의 Web Audio로 그 자리에서 만들어 냄
//
//  쓰는 법:  sound.play("coin")
//  - 오실레이터(oscillator) = 일정한 높이로 우는 '전자 피리'
//  - 게인(gain)             = 볼륨 손잡이. 손잡이를 빠르게 돌려 '띵'·'뚝' 같은 모양을 만듦
//  - 노이즈(noise)          = '치익' 하는 잡음. 칼질·바람·폭발 소리에 씀
// =====================================================

const sound = (() => {
  let ctx = null; // 오디오 장치. 사용자가 한 번 클릭해야 켤 수 있음 (브라우저 규칙)
  let master = null; // 전체 볼륨
  let noiseBuf = null;

  let muted = false;
  let musicMuted = false;
  try {
    muted = localStorage.getItem("wp-mute") === "1";
    musicMuted = localStorage.getItem("wp-music-mute") === "1";
  } catch (e) {}
  const VOLUME = 0.35;
  const MUSIC_VOLUME = 0.32; // 배경음악은 효과음보다 작게
  let musicBus = null; // 배경음악 전체 볼륨 (효과음과 따로 끄고 켬)

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = musicMuted ? 0 : MUSIC_VOLUME;
      musicBus.connect(ctx.destination);
      // 1초짜리 잡음을 한 번 만들어 두고 계속 재사용
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 첫 클릭·키 입력 때 오디오 장치를 깨워 둠
  function unlock() {
    if (!ensure()) return;
    // 장치가 완전히 켜진 뒤, 클릭 전에 정해 둔 곡이 있으면 이제 재생
    ctx.resume().then(() => wantTrack && startTrack(wantTrack));
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  }
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  // ---------- 재료 1: 음 하나 ----------
  // t: 시작 시각(초), f: 높이(Hz), to: 끝날 때 높이(미끄러지는 소리), d: 길이(초)
  function tone(t, f, d, opt = {}) {
    const { type = "square", to = null, vol = 0.25, attack = 0.005 } = opt;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + d);
    // 볼륨 모양: 0 → 빠르게 vol까지 → 천천히 0
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + d + 0.02);
  }

  // ---------- 재료 2: 잡음 ----------
  // filter: 어떤 높이의 잡음만 남길지 (낮으면 '쿵', 높으면 '칙')
  function noise(t, d, opt = {}) {
    const { vol = 0.2, freq = 1200, to = null, type = "bandpass", q = 1 } = opt;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(freq, t);
    if (to) filt.frequency.exponentialRampToValueAtTime(to, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(filt).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + d + 0.02);
  }

  // 음 여러 개를 차례로: notes = [[높이, 길이], ...]
  function melody(t, notes, opt) {
    let at = t;
    for (const [f, d] of notes) {
      if (f) tone(at, f, d * 0.95, opt);
      at += d;
    }
  }

  // 음 이름 → 높이 (C4 = 도)
  const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568 };

  // ---------- 효과음 목록 ----------
  const SFX = {
    // UI
    click: (t) => tone(t, 1400, 0.03, { vol: 0.12 }),
    tab: (t) => { tone(t, 900, 0.04, { vol: 0.12 }); tone(t + 0.04, 1350, 0.05, { vol: 0.1 }); },
    error: (t) => { tone(t, 180, 0.12, { type: "sawtooth", vol: 0.15 }); tone(t + 0.13, 140, 0.18, { type: "sawtooth", vol: 0.15 }); },
    ping: (t) => { tone(t, N.E6, 0.12, { type: "triangle", vol: 0.18 }); tone(t + 0.1, N.G6, 0.25, { type: "triangle", vol: 0.14 }); },

    // 채팅
    msgOut: (t) => tone(t, 700, 0.05, { vol: 0.1, to: 1000 }),
    msgIn: (t) => { tone(t, 1100, 0.04, { vol: 0.12 }); tone(t + 0.05, 1500, 0.06, { vol: 0.1 }); },
    whisper: (t) => noise(t, 0.12, { vol: 0.08, freq: 3000, q: 4 }), // 도청: 치직

    // 돈
    coin: (t) => { tone(t, N.B5, 0.06, { vol: 0.15 }); tone(t + 0.06, N.E6, 0.22, { vol: 0.15 }); },
    spend: (t) => { tone(t, N.E5, 0.05, { vol: 0.12 }); tone(t + 0.05, N.B4, 0.1, { vol: 0.1 }); },
    gavel: (t) => { noise(t, 0.05, { vol: 0.35, freq: 900, to: 300 }); tone(t, 150, 0.12, { type: "square", vol: 0.12 }); noise(t + 0.16, 0.05, { vol: 0.3, freq: 900, to: 300 }); tone(t + 0.16, 140, 0.18, { type: "square", vol: 0.1 }); tone(t + 0.22, N.E6, 0.35, { type: "triangle", vol: 0.12 }); },
    bid: (t) => { tone(t, N.A5, 0.05, { vol: 0.12 }); tone(t + 0.05, N.C6, 0.12, { vol: 0.12 }); },
    sold: (t) => { tone(t, 330, 0.1, { type: "triangle", vol: 0.2 }); tone(t + 0.1, 220, 0.25, { type: "triangle", vol: 0.2 }); },

    // 단계 전환
    night: (t) => { // 어두워지는 낮은 화음
      tone(t, 220, 0.9, { type: "triangle", vol: 0.16, to: 147, attack: 0.08 });
      tone(t, 330, 0.9, { type: "triangle", vol: 0.1, to: 220, attack: 0.08 });
      noise(t, 0.8, { vol: 0.05, freq: 400, to: 150, type: "lowpass" });
    },
    morning: (t) => melody(t, [[N.C5, 0.1], [N.E5, 0.1], [N.G5, 0.1], [N.C6, 0.35]], { type: "triangle", vol: 0.16 }),
    speech: (t) => { tone(t, N.G4, 0.12, { vol: 0.12 }); tone(t + 0.12, N.C5, 0.3, { vol: 0.12 }); },
    vote: (t) => { // 경고음 두 번
      tone(t, 660, 0.18, { type: "square", vol: 0.12 });
      tone(t + 0.24, 660, 0.18, { type: "square", vol: 0.12 });
    },
    door: (t) => { // 밀담 부스 문: 공기 빠지는 소리 + 철컥
      noise(t, 0.35, { vol: 0.18, freq: 2500, to: 400, q: 0.8 });
      tone(t + 0.3, 120, 0.08, { type: "square", vol: 0.18 });
      noise(t + 0.3, 0.06, { vol: 0.2, freq: 900, q: 2 });
    },
    tick: (t) => tone(t, 1800, 0.025, { vol: 0.08 }),
    tickLast: (t) => tone(t, 2400, 0.05, { vol: 0.12 }),

    // 시작 연출
    intro: (t) => { // 비행선 엔진이 낮게 울림
      tone(t, 55, 2.2, { type: "sawtooth", vol: 0.06, to: 70, attack: 0.6 });
      noise(t, 2.2, { vol: 0.05, freq: 300, type: "lowpass" });
    },
    flip: (t) => { noise(t, 0.15, { vol: 0.15, freq: 1500, to: 4000 }); tone(t + 0.12, N.C6, 0.3, { type: "triangle", vol: 0.15 }); },

    // 아침 사건
    step: (t) => noise(t, 0.05, { vol: 0.08, freq: 600, q: 2 }),
    slash: (t) => { noise(t, 0.18, { vol: 0.3, freq: 5000, to: 800, q: 1.5 }); tone(t + 0.05, 160, 0.2, { type: "sawtooth", vol: 0.12, to: 60 }); },
    heal: (t) => melody(t, [[N.C5, 0.07], [N.E5, 0.07], [N.G5, 0.07], [N.C6, 0.07], [N.E6, 0.25]], { type: "triangle", vol: 0.12 }),
    down: (t) => { tone(t, 300, 0.6, { type: "triangle", vol: 0.18, to: 60 }); },
    alarm: (t) => { // 처형: 사이렌 3번
      for (let i = 0; i < 3; i++) tone(t + i * 0.3, 600, 0.28, { type: "sawtooth", vol: 0.1, to: 900 });
    },
    fly: (t) => noise(t, 1.1, { vol: 0.25, freq: 300, to: 3000, q: 0.7 }), // 바람에 빨려 나감

    // 내 상태
    hurt: (t) => { noise(t, 0.2, { vol: 0.3, freq: 300, type: "lowpass" }); tone(t, 110, 0.25, { type: "square", vol: 0.15, to: 50 }); },

    // 카지노
    reel: (t) => tone(t, 500, 0.05, { vol: 0.15 }),
    win: (t) => melody(t, [[N.C5, 0.08], [N.E5, 0.08], [N.G5, 0.08], [N.C6, 0.08], [N.G5, 0.08], [N.C6, 0.3]], { vol: 0.13 }),
    lose: (t) => melody(t, [[N.G4, 0.15], [N.E4, 0.15], [N.C4, 0.4]], { type: "triangle", vol: 0.15 }),

    // 다크넷 터미널
    type: (t) => { for (let i = 0; i < 6; i++) tone(t + i * 0.05, 1200 + Math.random() * 800, 0.02, { vol: 0.05 }); },

    // 게임 결과
    victory: (t) => {
      melody(t, [[N.G4, 0.12], [N.C5, 0.12], [N.E5, 0.12], [N.G5, 0.24], [N.E5, 0.12], [N.G5, 0.5]], { vol: 0.13 });
      melody(t, [[N.E4, 0.36], [N.C5, 0.36], [N.E5, 0.62]], { type: "triangle", vol: 0.1 });
    },
    defeat: (t) => melody(t, [[N.E5, 0.25], [N.D5, 0.25], [N.C5, 0.25], [N.B4, 0.7]], { type: "triangle", vol: 0.15 }),
  };

  function play(name, delayMs = 0) {
    if (muted || !SFX[name]) return;
    try {
      if (!ensure() || ctx.state !== "running") return; // 아직 클릭 전이면 조용히 넘어감
      SFX[name](ctx.currentTime + 0.01 + delayMs / 1000);
    } catch (e) {
      /* 소리가 안 나도 게임은 계속 */
    }
  }

  // 룰렛: 처음엔 빠르게, 점점 느려지는 '딱딱딱'
  function spin(ms) {
    if (muted) return;
    try {
      if (!ensure() || ctx.state !== "running") return;
      let at = 0;
      let gap = 0.04;
      while (at < ms / 1000) {
        tone(ctx.currentTime + 0.01 + at, 1600, 0.02, { vol: 0.07 });
        at += gap;
        gap *= 1.07;
      }
    } catch (e) {}
  }

  // =====================================================
  //  배경음악
  //  <audio loop> 대신 Web Audio로 반복 → 이음매 없이 매끄럽게 돎
  //  길이(초)는 미리 잘라 둔 반복 구간 길이 (public/audio/*.mp3)
  // =====================================================
  const TRACKS = { lobby: 32.7765, night: 89.4544, talk: 131.3478, vote: 42.992, casino: 59.5539 };
  const FADE = 1.2; // 곡이 바뀔 때 겹치는 시간(초)
  const buffers = {}; // 한 번 받은 곡은 다시 받지 않음
  let wantTrack = null; // 지금 나와야 할 곡 이름
  let current = null; // { name, src, gain }

  function loadTrack(name) {
    if (!buffers[name]) {
      buffers[name] = fetch("audio/" + name + ".mp3")
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => null); // 파일이 없으면 조용히 넘어감
    }
    return buffers[name];
  }

  // mp3는 맨 앞에 아주 짧은 무음이 붙을 수 있어서, 실제 소리가 시작되는 지점을 찾음
  function soundStart(buf) {
    const d = buf.getChannelData(0);
    const max = Math.min(d.length, Math.floor(buf.sampleRate * 0.2));
    for (let i = 0; i < max; i++) if (Math.abs(d[i]) > 0.0001) return i / buf.sampleRate;
    return 0;
  }

  async function startTrack(name) {
    if (!ensure() || ctx.state !== "running") return;
    if (current && current.name === name) return;
    const buf = await loadTrack(name);
    if (wantTrack !== name || (current && current.name === name)) return; // 받는 사이에 곡이 또 바뀜
    fadeOutCurrent();
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const start = soundStart(buf);
    src.loopStart = start;
    src.loopEnd = Math.min(buf.duration, start + TRACKS[name]);
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + FADE);
    src.connect(gain).connect(musicBus);
    src.start(t, start);
    current = { name, src, gain };
  }

  function fadeOutCurrent() {
    if (!current) return;
    const { src, gain } = current;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + FADE);
    src.stop(t + FADE + 0.05);
    current = null;
  }

  // music(null) = 음악 멈춤
  function music(name) {
    if (name && !TRACKS[name]) name = null;
    if (name === wantTrack) return;
    wantTrack = name;
    if (!ctx || ctx.state !== "running") return; // 첫 클릭 때 unlock()이 대신 틀어 줌
    if (name) startTrack(name);
    else fadeOutCurrent();
  }

  function setMusicMuted(m) {
    musicMuted = m;
    try {
      localStorage.setItem("wp-music-mute", m ? "1" : "0");
    } catch (e) {}
    if (musicBus) {
      const t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(m ? 0 : MUSIC_VOLUME, t + 0.3);
    }
  }

  function setMuted(m) {
    muted = m;
    try {
      localStorage.setItem("wp-mute", m ? "1" : "0");
    } catch (e) {}
    if (master) master.gain.value = m ? 0 : VOLUME;
  }

  return {
    play, spin, setMuted, isMuted: () => muted,
    music, setMusicMuted, isMusicMuted: () => musicMuted,
    nowPlaying: () => (current ? current.name : null),
  };
})();
