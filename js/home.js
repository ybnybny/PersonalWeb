// =====================================================================
// home.js — 主房间逻辑（控制台/留言板/唱片机/门/生态物件/猫）
// =====================================================================
import { supabase } from './supabase.js';
import { getLight, getBgm } from './settings.js';
import { el, setText, toast, toastLoadError } from './ui.js';
import { Npc } from './npc.js';

const $ = (id) => document.getElementById(id);

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
$('message-board').addEventListener('click', () => { openPanel('board-panel'); loadQuestions(1); });

// ---------- 控制台：航行日志 / 通讯坐标 ----------

function md(text) {
  const html = window.marked.parse(text || '');
  return window.DOMPurify.sanitize(html);
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

async function loadQuestions(page = 1, append = false) {
  const body = $('board-body');
  if (!append) {
    body.innerHTML = '';
    body.appendChild(renderSubmitForm());
  }
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
      if (item.answer) {
        setText(aEl, `答：${item.answer}`);
      } else {
        setText(aEl, '待回复');
        aEl.classList.add('qa-pending');
      }
      qEl.appendChild(aEl);
      list.appendChild(qEl);
    });

    const hasMore = boardPage * PAGE_SIZE < boardTotal;
    const oldMore = body.querySelector('.load-more');
    if (oldMore) oldMore.remove();
    if (hasMore) {
      body.appendChild(el('button', { class: 'load-more', onclick: () => loadQuestions(boardPage + 1, true) }, '加载更多'));
    }
  } catch {
    toastLoadError(() => loadQuestions(page, append));
  }
}

let lastSubmit = 0;

function renderSubmitForm() {
  const wrap = el('div', { style: 'border-top:1px dashed var(--border); padding-top:12px; margin-bottom:12px;' });
  wrap.appendChild(el('h3', { style: 'font-size:14px' }, '投递便签'));

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
  if (now - lastSubmit < 10000) {
    toast('稍后再试');
    return;
  }
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
    $('f-content').value = '';
    $('f-name').value = '';
    $('f-email').value = '';
    document.querySelector('input[name="hp"]').value = '';
    const counter = document.querySelector('#board-body .counter');
    if (counter) counter.textContent = '0 / 100';
    boardPage = 1;
    loadQuestions(1);
  } catch (e) {
    toast('操作失败');
  }
}

// ---------- 初始化 ----------

applyLight(getLight());
updateRecordPlayer();

const npc = new Npc($('room'));
npc.startIdle();
npc.renderPosition();
