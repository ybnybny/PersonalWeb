// =====================================================================
// shell.js — 常驻外壳逻辑
// URL 路由（?room=）+ 边栏（传送器/开关灯/音乐）+ <audio> 播放器 + 跨 iframe 消息
// =====================================================================
import { getLight, setLight, getBgm, setBgm } from './settings.js';

const ROOMS = {
  home: 'home.html',
  forest: 'forest.html',
  library: 'library.html',
};
const TRACKS = ['assets/audio/bgm-1.mp3', 'assets/audio/bgm-2.mp3'];

const iframe = document.getElementById('content');
const audio = document.getElementById('bgm');
const lightToggle = document.getElementById('light-toggle');
const musicToggle = document.getElementById('music-toggle');
const musicPrev = document.getElementById('music-prev');
const musicNext = document.getElementById('music-next');
const musicTrack = document.getElementById('music-track');
const mobileBlock = document.getElementById('mobile-block');

let currentRoom = 'home';
let bgm = getBgm();
let audioMissing = false;

// ---------- 路由 ----------

function roomFromUrl() {
  const room = new URLSearchParams(location.search).get('room');
  return ROOMS[room] ? room : 'home';
}

function setRoom(room, { push = true } = {}) {
  if (!ROOMS[room]) return;
  currentRoom = room;
  iframe.src = ROOMS[room];
  document.querySelectorAll('.room-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.room === room);
  });
  if (push) {
    history.pushState({ room }, '', `?room=${room}`);
  }
}

window.addEventListener('popstate', () => {
  setRoom(roomFromUrl(), { push: false });
});

document.querySelectorAll('.room-btn').forEach((b) => {
  b.addEventListener('click', () => setRoom(b.dataset.room));
});

// ---------- 移动端拦截 ----------

function detectMobile() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return window.innerWidth < 768 || coarse;
}

function applyMobileBlock() {
  if (detectMobile()) {
    mobileBlock.classList.add('show');
    iframe.hidden = true;
    iframe.src = 'about:blank';
  } else {
    mobileBlock.classList.remove('show');
    iframe.hidden = false;
    if (!iframe.src || iframe.src === 'about:blank') iframe.src = ROOMS[currentRoom];
  }
}

window.addEventListener('resize', applyMobileBlock);

// ---------- 跨 iframe 消息 ----------

function broadcast(msg) {
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage(msg, location.origin);
  }
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return; // 安全：忽略异源消息
  const msg = e.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'navigate' && ROOMS[msg.room]) {
    setRoom(msg.room); // 门切房（传送器在边栏内直接切房）
  } else if (msg.type === 'music' && msg.action) {
    handleMusicCommand(msg.action, true); // 唱片机指令视为用户手势 → 惊扰猫
  } else if (msg.type === 'interact') {
    tryUnlockMusic(); // 内容页内的首次手势 → 尝试解锁音乐
  }
});

// ---------- 开关灯 ----------

function renderLight() {
  const on = getLight() === 'on';
  document.documentElement.dataset.light = on ? 'on' : 'off';
  lightToggle.textContent = `灯：${on ? '开' : '灭'}`;
}

lightToggle.addEventListener('click', () => {
  const next = getLight() === 'on' ? 'off' : 'on';
  setLight(next);
  renderLight();
  broadcast({ type: 'light', value: next });
});

// ---------- 背景音乐 ----------

function loadTrack() {
  audio.src = TRACKS[bgm.trackIndex % TRACKS.length];
  audio.currentTime = bgm.currentTime || 0;
}

function tryUnlockMusic() {
  if (bgm.on && audio.paused) {
    if (!audio.src) loadTrack();
    audio.play().catch(() => {});
  }
}

function renderMusic() {
  musicTrack.textContent = `曲目 ${(bgm.trackIndex % TRACKS.length) + 1}/${TRACKS.length}`;
  const playing = !audio.paused && !audio.ended;
  musicToggle.textContent = playing ? '⏸ 暂停' : '▶ 播放';
}

function handleMusicCommand(action, startle) {
  if (action === 'toggle') action = audio.paused ? 'play' : 'pause';
  switch (action) {
    case 'play':
      if (!audio.src) loadTrack();
      if (audio.paused) {
        audio.play().catch(() => {});
        bgm.on = true;
      }
      break;
    case 'pause':
      audio.pause();
      bgm.on = false;
      break;
    case 'next':
      bgm.trackIndex = (bgm.trackIndex + 1) % TRACKS.length;
      bgm.currentTime = 0;
      loadTrack();
      if (bgm.on) audio.play().catch(() => {});
      break;
    case 'prev':
      bgm.trackIndex = (bgm.trackIndex - 1 + TRACKS.length) % TRACKS.length;
      bgm.currentTime = 0;
      loadTrack();
      if (bgm.on) audio.play().catch(() => {});
      break;
  }
  saveBgm();
  renderMusic();
  broadcast({ type: 'music', action, startle });
}

musicToggle.addEventListener('click', () => {
  const action = audio.paused ? 'play' : 'pause';
  handleMusicCommand(action, true); // 用户手势 → startle:true
});

musicNext.addEventListener('click', () => handleMusicCommand('next', true));
musicPrev.addEventListener('click', () => handleMusicCommand('prev', true));

audio.addEventListener('ended', () => {
  // 一首播完自动进入下一首：startle:false，不惊扰猫
  handleMusicCommand('next', false);
});

audio.addEventListener('play', () => { bgm.on = true; renderMusic(); });
audio.addEventListener('pause', () => { renderMusic(); });
audio.addEventListener('error', () => {
  if (!audioMissing) {
    audioMissing = true;
    musicTrack.textContent = '音乐文件未找到：请放入 assets/audio/bgm-1.mp3、bgm-2.mp3';
  }
});

function saveBgm() {
  bgm.currentTime = (audio.currentTime || 0);
  // 注意：bgm.on 表示"意图"，只由用户手势的播放/暂停修改，不由自动播放拦截改写
  setBgm(bgm);
}

// 每 2 秒写回 currentTime（§6.5）
setInterval(saveBgm, 2000);

// ---------- 初始化 ----------

function init() {
  renderLight();
  // 音乐状态默认 on:true，但受浏览器自动播放限制：首次用户手势后才真正出声
  loadTrack();
  if (bgm.on) audio.play().catch(() => {});
  renderMusic();
  applyMobileBlock();
  setRoom(roomFromUrl(), { push: false });

  // 首次用户手势后尝试出声（自动播放策略）
  window.addEventListener('pointerdown', tryUnlockMusic, { once: true });
  window.addEventListener('keydown', tryUnlockMusic, { once: true });
}

init();
