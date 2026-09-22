// =====================================================================
// home.js — 主房间逻辑（控制台/留言板/唱片机/门/生态物件/猫）
// =====================================================================
import { supabase } from './supabase.js';
import { getLight, getBgm } from './settings.js';
import { el, setText, toast, toastLoadError } from './ui.js';
import { Npc } from './npc.js';
import { mountSnake } from './snake.js';
import { ROOM_ART } from './ascii.js';

const $ = (id) => document.getElementById(id);

// 渲染主房间物件字符画（按最长行补空格保证对齐）
function renderArt() {
  document.querySelectorAll('.ascii-art[data-art]').forEach((pre) => {
    const lines = ROOM_ART[pre.dataset.art] || [];
    if (!lines.length) return;
    const max = Math.max(...lines.map((l) => l.length));
    pre.textContent = lines.map((l) => l.padEnd(max)).join('\n');
  });
}

// 测量等宽字体字符宽度（用于绘制与房间尺寸严格对齐的墙）
function measureCharWidth() {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:inherit;font-size:inherit;letter-spacing:0;';
  probe.textContent = '──────────';
  document.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width / 10;
  probe.remove();
  return w;
}

// 用字符画绘制主房间四周的墙（底部中央留出入口 ENTRY 的缺口）
function renderWalls() {
  const room = $('room');
  const pre = $('room-walls');
  if (!room || !pre) return;
  const W = room.clientWidth;
  const H = room.clientHeight;
  if (W <= 0 || H <= 0) return;

  const cw = measureCharWidth();
  const fs = parseFloat(getComputedStyle(pre).fontSize) || 15;
  let cols = Math.max(3, Math.floor(W / cw));
  let rows = Math.max(3, Math.floor(H / (fs * 1.2)));

  // 微调字间距，使水平方向恰好铺满房间宽度
  let ls = (W - cols * cw) / Math.max(1, cols - 1);
  if (ls < -0.5) { cols -= 1; ls = (W - cols * cw) / Math.max(1, cols - 1); }
  pre.style.letterSpacing = Math.max(0, ls) + 'px';
  pre.style.lineHeight = (H / rows) + 'px';

  const gap = 16; // 底部中央缺口宽度（字符数）
  const g0 = Math.floor((cols - gap) / 2);
  const g1 = g0 + gap;

  const lines = ['┌' + '─'.repeat(cols - 2) + '┐'];
  for (let r = 1; r < rows - 1; r++) {
    lines.push('│' + ' '.repeat(cols - 2) + '│');
  }
  let bottom = '└';
  for (let c = 1; c < cols - 1; c++) bottom += (c >= g0 && c < g1) ? ' ' : '─';
  bottom += '┘';
  lines.push(bottom);

  pre.textContent = lines.join('\n');
}

// 时钟：显示访客本地时间
function renderClock() {
  const art = $('clock-art');
  if (!art) return;
  const d = new Date();
  const t = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0')).join(':');
  art.textContent = ['┌─────────┐', `│ ${t}│`, '└─────────┘'].join('\n');
}

// ---------- 开关灯 ----------

function applyLight(value) {
  document.documentElement.dataset.light = value;
  renderIntro();
}

function renderIntro() {
  const on = getLight() === 'on';
  $('room-intro').textContent = on
    ? '一间飘在数据海的小屋。没有名字。灯亮着。'
    : '一间飘在数据海的小屋。没有名字。灯灭了。';
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const msg = e.data;
  if (msg && msg.type === 'light') applyLight(msg.value);
  if (msg && msg.type === 'music') updateRecordPlayer();
});

// ---------- 门（postMessage 切房） ----------

document.querySelectorAll('.door').forEach((door) => {
  door.addEventListener('click', () => {
    const room = door.id === 'door-forest' ? 'forest' : 'library';
    window.parent.postMessage({ type: 'navigate', room }, location.origin);
  });
});

// ---------- 唱片机 ----------

function updateRecordPlayer() {
  const bgm = getBgm();
  const status = bgm.on ? '播放中' : '已暂停';
  document.querySelector('#record-player .object-tooltip').textContent =
    `音乐：${status} · 曲目 ${(bgm.trackIndex % 2) + 1}/2`;
}

$('record-player').addEventListener('click', () => {
  window.parent.postMessage({ type: 'music', action: 'toggle' }, location.origin);
});

// ---------- 面板通用 ----------

function openPanel(id) { $(id).classList.remove('hidden'); }
function closePanel(id) { $(id).classList.add('hidden'); }

document.querySelectorAll('[data-close]').forEach((b) => {
  b.addEventListener('click', () => closePanel(b.dataset.close));
});

$('console').addEventListener('click', () => { openPanel('console-panel'); showLog(); });
$('message-board').addEventListener('click', () => { openPanel('board-panel'); showBoard('list'); });

// ---------- 电脑（老式大头一体机） ----------

const COMPUTER = { sw: 46, sh: 24 };

let snakeStop = null;
let computerMode = null; // 'menu' | 'about' | 'snake' | null

function stopSnake() {
  if (snakeStop) { snakeStop(); snakeStop = null; }
}

function renderComputerFrame() {
  const L = (a, b, c) => a + b.repeat(COMPUTER.sw) + c;
  const rows = [L('╭', '─', '╮')];
  for (let i = 0; i < COMPUTER.sh; i++) rows.push(L('│', ' ', '│'));
  rows.push(L('╰', '─', '╯'));
  rows.push(L('┌', '─', '┐'));
  rows.push('│' + '  ░░░░      ●       ░░░░      '.padEnd(COMPUTER.sw) + '│');
  rows.push(L('└', '─', '┘'));
  $('computer-frame').textContent = rows.join('\n');
}

function crtItem(text, action) {
  return el('div', { class: 'crt-item', onclick: action }, text);
}

function renderComputerMenu() {
  computerMode = 'menu';
  stopSnake();
  const s = $('computer-screen');
  s.innerHTML = '';
  s.append(
    el('div', { class: 'crt-title' }, 'XIAOWU-DOS v1.0 · 小屋电脑'),
    el('div', { class: 'crt-blank' }),
    crtItem('[1] 贪吃蛇  SNAKE', () => launchSnake()),
    crtItem('[2] 关于本机', () => showComputerAbout()),
    crtItem('[3] 关机', () => closeComputer()),
    el('div', { class: 'crt-blank' }),
    el('div', { class: 'crt-hint' }, '按数字键 1-3 选择 · ESC 关机'),
  );
}

function showComputerAbout() {
  computerMode = 'about';
  const s = $('computer-screen');
  s.innerHTML = '';
  s.append(
    el('div', { class: 'crt-title' }, '关于本机'),
    el('div', { class: 'crt-text' }, '一台飘在数据海的老式大头电脑。'),
    el('div', { class: 'crt-text' }, '它只会跑贪吃蛇。大概。'),
    el('div', { class: 'crt-blank' }),
    crtItem('[0] 返回菜单', () => renderComputerMenu()),
  );
}

function launchSnake() {
  computerMode = 'snake';
  stopSnake();
  const s = $('computer-screen');
  s.innerHTML = '';
  const bar = el('div', { class: 'crt-bar' },
    el('button', { onclick: () => renderComputerMenu() }, '← 返回菜单'),
    el('span', { class: 'crt-hint' }, '[Q] 返回菜单'),
  );
  const wrap = el('div', { id: 'snake-wrap' });
  s.append(bar, wrap);
  snakeStop = mountSnake(wrap);
}

function openComputer() {
  openPanel('computer-panel');
  renderComputerFrame();
  renderComputerMenu();
}

function closeComputer() {
  stopSnake();
  computerMode = null;
  closePanel('computer-panel');
}

$('desk').addEventListener('click', () => openComputer());

document.addEventListener('keydown', (e) => {
  if (!computerMode) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.key;
  if (computerMode === 'menu') {
    if (k === '1') launchSnake();
    else if (k === '2') showComputerAbout();
    else if (k === '3' || k === 'Escape') closeComputer();
  } else if (computerMode === 'about') {
    if (k === '0' || k === 'Escape') renderComputerMenu();
  } else if (computerMode === 'snake') {
    if (k.toLowerCase() === 'q' || k === 'Escape') renderComputerMenu();
  }
});

// ---------- 控制台：航行日志 / 通讯坐标 ----------

function md(text) {
  const marked = window.marked;
  const raw = (marked && marked.parse)
    ? marked.parse(text || '')
    : String(text || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  return (window.DOMPurify && window.DOMPurify.sanitize) ? window.DOMPurify.sanitize(raw) : raw;
}

async function showLog() {
  const body = $('panel-body');
  body.innerHTML = '';
  try {
    const { data, error } = await supabase.from('profile').select('*').eq('id', 1).single();
    if (error) throw error;
    const meta = el('div', { class: 'meta-row' },
      el('span', {}, `空间编号：${data.space_id || '—'}`),
      el('span', {}, `当前状态：${data.status || '—'}`),
      el('span', {}, `属空间：${data.affiliation || '—'}`),
    );
    const content = el('div', { class: 'markdown-body' });
    content.innerHTML = md(data.log_md);
    body.append(meta, content);
  } catch {
    body.innerHTML = '';
    toastLoadError(() => showLog());
  }
}

async function showLinks() {
  const body = $('panel-body');
  body.innerHTML = '';
  try {
    const { data, error } = await supabase
      .from('friend_links')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) {
      body.appendChild(el('div', { style: 'color:var(--muted)' }, '还没有友链。'));
      return;
    }
    const list = el('div');
    data.forEach((f) => {
      list.appendChild(el('div', { style: 'margin-bottom:8px' },
        el('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.name),
        f.desc ? el('div', { style: 'color:var(--muted);font-size:13px' }, f.desc) : null,
      ));
    });
    body.appendChild(list);
  } catch {
    toastLoadError(() => showLinks());
  }
}

$('tab-log').addEventListener('click', showLog);
$('tab-links').addEventListener('click', showLinks);

// ---------- 留言板 ----------

const PAGE_SIZE = 20;
let boardPage = 1;
let boardTotal = 0;

function showBoard(view) {
  $('board-tab-list').classList.toggle('active', view === 'list');
  $('board-tab-form').classList.toggle('active', view === 'form');
  const body = $('board-body');
  body.innerHTML = '';
  if (view === 'list') loadQuestionList();
  else body.appendChild(renderSubmitForm());
}

$('board-tab-list').addEventListener('click', () => showBoard('list'));
$('board-tab-form').addEventListener('click', () => showBoard('form'));

async function loadQuestionList(page = 1, append = false) {
  const body = $('board-body');
  if (!append) { body.innerHTML = ''; boardPage = page; }
  try {
    const [q, c] = await Promise.all([
      supabase.rpc('get_published_questions', { page, page_size: PAGE_SIZE }),
      supabase.rpc('get_published_questions_count'),
    ]);
    if (q.error) throw q.error;
    boardTotal = Number(c.data || 0);
    const list = body.querySelector('.qa-list') || el('div', { class: 'qa-list' });
    if (!body.querySelector('.qa-list')) body.appendChild(list);

    (q.data || []).forEach((item) => {
      const name = item.submitter_name ? item.submitter_name : '匿名';
      const qEl = el('div', { class: 'qa-item' });
      const qLine = el('div', { class: 'qa-q' });
      setText(qLine, `问：${item.content}`);
      qEl.appendChild(qLine);
      qEl.appendChild(el('div', { style: 'font-size:12px;color:var(--muted)' }, `—— ${name}`));
      const aEl = el('div', { class: 'qa-a' });
      if (item.answer) { setText(aEl, `答：${item.answer}`); }
      else { setText(aEl, '待回复'); aEl.classList.add('qa-pending'); }
      qEl.appendChild(aEl);
      list.appendChild(qEl);
    });

    const oldMore = body.querySelector('.load-more');
    if (oldMore) oldMore.remove();
    if (boardPage * PAGE_SIZE < boardTotal) {
      body.appendChild(el('button', { class: 'load-more', onclick: () => loadQuestionList(boardPage + 1, true) }, '加载更多'));
    }
  } catch {
    toastLoadError(() => loadQuestionList(page, append));
  }
}

let lastSubmit = 0;

function renderSubmitForm() {
  const wrap = el('div', {});
  const content = el('textarea', { id: 'f-content', maxlength: '100', rows: '3', style: 'width:100%' });
  const contentCount = el('div', { class: 'counter' }, '0 / 100');
  content.addEventListener('input', () => { contentCount.textContent = `${content.value.length} / 100`; });

  const name = el('input', { id: 'f-name', type: 'text', maxlength: '20', placeholder: '留言人（选填，留空=匿名）', style: 'width:100%' });
  const email = el('input', { id: 'f-email', type: 'email', placeholder: '邮箱（选填，仅后台可见）', style: 'width:100%' });

  const mode = el('div', {},
    el('label', {}, el('input', { type: 'radio', name: 'f-mode', value: 'public', checked: true }), ' 公开'),
    el('label', { style: 'margin-left:12px' }, el('input', { type: 'radio', name: 'f-mode', value: 'private' }), ' 不公开'),
  );
  // 蜜罐字段：对用户隐藏
  const hp = el('input', { type: 'text', name: 'hp', style: 'position:absolute;left:-9999px;opacity:0', tabindex: '-1', autocomplete: 'off' });

  const submit = el('button', { onclick: onSubmit }, '投递');
  const note = el('div', { style: 'font-size:12px;color:var(--muted);margin-top:6px' }, '投递后进入待审核，公开/不公开由你选择；回答由站主回复。');

  wrap.append(
    el('div', { class: 'form-field' }, el('label', {}, '留言内容（必填，≤100 字）'), content, contentCount),
    el('div', { class: 'form-field' }, el('label', {}, '留言人（≤20 字）'), name),
    el('div', { class: 'form-field' }, el('label', {}, '邮箱'), email),
    el('div', { class: 'form-field' }, el('label', {}, '公开/不公开'), mode),
    hp, submit, note,
  );
  return wrap;
}

async function onSubmit() {
  const now = Date.now();
  if (now - lastSubmit < 10000) { toast('稍后再试'); return; }
  const content = $('f-content').value.trim();
  if (!content) { toast('留言内容不能为空'); return; }
  const name = $('f-name').value.trim();
  const email = $('f-email').value.trim();
  const mode = document.querySelector('input[name="f-mode"]:checked').value;
  const hp = document.querySelector('input[name="hp"]').value;

  lastSubmit = now;
  try {
    const { error } = await supabase.rpc('submit_question', {
      p_content: content,
      p_display_mode: mode,
      p_submitter_name: name || null,
      p_submitter_email: email || null,
      p_hp: hp || null,
    });
    if (error) throw error;
    toast('便签已投递');
    boardPage = 1;
    showBoard('list');
  } catch (e) {
    toast('操作失败');
  }
}

// ---------- 初始化 ----------

applyLight(getLight());
updateRecordPlayer();
renderWalls();
renderArt();
renderClock();
setInterval(renderClock, 1000);

const npc = new Npc($('room'));
npc.startIdle();
npc.renderPosition();
