// =====================================================================
// library.js — 图书馆：Markdown 档案馆（updated_at 倒序 + 分页 + 标签检索）
// =====================================================================
import { supabase } from './supabase.js';
import { getLight } from './settings.js';
import { el, setText, toastLoadError } from './ui.js';
import { Npc } from './npc.js';

const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 20;

function applyLight(value) {
  document.documentElement.dataset.light = value;
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const msg = e.data;
  if (msg && msg.type === 'light') applyLight(msg.value);
});

$('back-door').addEventListener('click', () => {
  window.parent.postMessage({ type: 'navigate', room: 'home' }, location.origin);
});

document.querySelector('[data-close]').addEventListener('click', () => {
  $('detail-panel').classList.add('hidden');
});

function md(text) {
  const marked = window.marked;
  const raw = (marked && marked.parse)
    ? marked.parse(text || '')
    : String(text || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  return (window.DOMPurify && window.DOMPurify.sanitize) ? window.DOMPurify.sanitize(raw) : raw;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let activeTag = null;
let page = 1;
let total = 0;

// 标签列表：单独全量查询 tags（不分页）聚合去重
async function loadTags() {
  const bar = $('tag-bar');
  bar.innerHTML = '';
  try {
    const { data, error } = await supabase.from('library_items').select('tags');
    if (error) throw error;
    const set = new Set();
    (data || []).forEach((row) => (row.tags || []).forEach((t) => set.add(t)));
    const tags = [...set].sort();
    const allBtn = el('button', { class: 'tag-btn active', onclick: () => selectTag(null) }, '全部');
    bar.appendChild(allBtn);
    tags.forEach((t) => {
      bar.appendChild(el('button', { class: 'tag-btn', onclick: () => selectTag(t) }, t));
    });
  } catch {
    toastLoadError(loadTags);
  }
}

function selectTag(tag) {
  activeTag = tag;
  document.querySelectorAll('.tag-btn').forEach((b) => b.classList.toggle('active', b.textContent === (tag || '全部')));
  page = 1;
  loadItems(true);
}

async function loadItems(reset = false) {
  const list = $('lib-list');
  if (reset) list.innerHTML = '';
  try {
    let query = supabase
      .from('library_items')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (activeTag) query = query.contains('tags', [activeTag]);

    const { data, error, count } = await query;
    if (error) throw error;
    total = count || 0;

    (data || []).forEach((item) => {
      const tags = (item.tags || []).map((t) => `#${t}`).join(' ');
      const meta = el('div', { class: 'lib-meta' },
        el('span', {}, fmtDate(item.updated_at)),
        tags ? el('span', {}, tags) : null,
      );
      const node = el('div', { class: 'lib-item', onclick: () => openDetail(item) },
        el('div', { class: 'lib-title' }, item.title),
        meta,
        item.summary ? el('div', { class: 'lib-summary' }, item.summary) : null,
      );
      list.appendChild(node);
    });

    renderMore();
  } catch {
    toastLoadError(() => loadItems(reset));
  }
}

function renderMore() {
  const more = $('lib-more');
  more.innerHTML = '';
  if (page * PAGE_SIZE < total) {
    more.appendChild(el('button', { onclick: () => { page++; loadItems(); } }, '加载更多'));
  }
}

async function openDetail(item) {
  $('detail-title').textContent = item.title;
  const tags = (item.tags || []).map((t) => `#${t}`).join(' ');
  $('detail-meta').textContent = `${fmtDate(item.updated_at)}${tags ? ' · ' + tags : ''}`;
  $('detail-body').innerHTML = md(item.content_md);

  const nodesWrap = $('detail-nodes');
  nodesWrap.innerHTML = '';
  try {
    const { data: links } = await supabase.from('knowledge_node_links').select('node_id').eq('library_item_id', item.id);
    const nodeIds = (links || []).map((l) => l.node_id);
    if (nodeIds.length) {
      const { data } = await supabase.from('knowledge_nodes').select('id, label').in('id', nodeIds);
      if (data && data.length) {
        nodesWrap.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-bottom:6px' }, '相关节点'));
        data.forEach((n) => {
          nodesWrap.appendChild(el('button', { style: 'margin:2px 4px 2px 0', onclick: () => openNode(n.id) }, n.label));
        });
      }
    }
  } catch { /* 忽略 */ }

  $('detail-panel').classList.remove('hidden');
}

function openNode(nodeId) {
  localStorage.setItem('cv_open_node', nodeId);
  window.parent.postMessage({ type: 'navigate', room: 'forest' }, location.origin);
}

applyLight(getLight());
loadTags();
loadItems(true);

// 从森林「前往图书馆查看」跳转过来时自动打开对应文章
const pendingItem = localStorage.getItem('cv_open_item');
if (pendingItem) {
  localStorage.removeItem('cv_open_item');
  (async () => {
    try {
      const { data, error } = await supabase.from('library_items').select('*').eq('id', pendingItem).single();
      if (!error && data) openDetail(data);
    } catch { /* 忽略 */ }
  })();
}

const npc = new Npc(document.querySelector('.content-page'));
npc.startIdle();
npc.renderPosition();
