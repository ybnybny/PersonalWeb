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
  const html = window.marked.parse(text || '');
  return window.DOMPurify.sanitize(html);
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

function openDetail(item) {
  $('detail-title').textContent = item.title;
  const tags = (item.tags || []).map((t) => `#${t}`).join(' ');
  $('detail-meta').textContent = `${fmtDate(item.updated_at)}${tags ? ' · ' + tags : ''}`;
  $('detail-body').innerHTML = md(item.content_md);
  $('detail-panel').classList.remove('hidden');
}

applyLight(getLight());
loadTags();
loadItems(true);

const npc = new Npc(document.querySelector('.content-page'));
npc.startIdle();
npc.renderPosition();
