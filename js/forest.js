// =====================================================================
// forest.js — 森林：知识图谱（Cytoscape.js + fcose）
// 公开页：平移/缩放/点击展开，节点不可拖动
// =====================================================================
import { supabase } from './supabase.js';
import { getLight } from './settings.js';
import { el, toastLoadError } from './ui.js';
import { Npc } from './npc.js';

const $ = (id) => document.getElementById(id);

// fcose 的 UMD 构建只暴露 window.cytoscapeFcose，不会自动注册，需手动注册到 cytoscape
if (window.cytoscape && window.cytoscapeFcose) {
  window.cytoscape.use(window.cytoscapeFcose);
}

function md(text) {
  const marked = window.marked;
  const raw = (marked && marked.parse)
    ? marked.parse(text || '')
    : String(text || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  return (window.DOMPurify && window.DOMPurify.sanitize) ? window.DOMPurify.sanitize(raw) : raw;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

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

// 节点详情弹窗关闭
function closeNodePanel() {
  $('node-panel').classList.add('hidden');
}

document.querySelectorAll('[data-close]').forEach((b) => {
  b.addEventListener('click', () => closeNodePanel());
});
const nodePanel = $('node-panel');
if (nodePanel) {
  nodePanel.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeNodePanel(); // 点遮罩空白处关闭
  });
}

let cy = null;
let tagColorMap = {};
let libraryMap = {};
let nodeLinks = {};

function showNode(node) {
  const d = node.data();
  $('node-label').textContent = d.label || '';
  $('node-desc').innerHTML = md(d.desc || '');

  const tagsWrap = $('node-tags');
  if (tagsWrap) {
    tagsWrap.innerHTML = '';
    (d.tags || []).forEach((t) => {
      const color = tagColorMap[t];
      tagsWrap.appendChild(el('span', { class: 'tag-chip', style: color ? `background:${color}` : '' }, t));
    });
  }

  const linkWrap = $('node-link');
  if (linkWrap) {
    linkWrap.innerHTML = '';
    const ids = nodeLinks[d.id] || [];
    if (ids.length) {
      const box = el('div', { style: 'border-top:1px dashed var(--border);padding-top:8px;' },
        el('div', { style: 'font-size:12px;color:var(--muted);margin-bottom:4px' }, '相关文章'),
      );
      ids.forEach((lid) => {
        if (!libraryMap[lid]) return;
        box.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin:3px 0;' },
          el('span', {}, libraryMap[lid]),
          el('button', { onclick: () => openLibraryItem(lid) }, '查看'),
        ));
      });
      linkWrap.appendChild(box);
    }
  }

  $('node-panel').classList.remove('hidden');
}

function openLibraryItem(itemId) {
  localStorage.setItem('cv_open_item', itemId);
  window.parent.postMessage({ type: 'navigate', room: 'library' }, location.origin);
}

async function loadForest() {
  try {
    const [nodesRes, edgesRes, tagsRes, libRes, linksRes] = await Promise.all([
      supabase.from('knowledge_nodes').select('*'),
      supabase.from('knowledge_edges').select('*'),
      supabase.from('knowledge_tags').select('*'),
      supabase.from('library_items').select('id, title'),
      supabase.from('knowledge_node_links').select('node_id, library_item_id'),
    ]);
    if (nodesRes.error) throw nodesRes.error;
    if (edgesRes.error) throw edgesRes.error;

    tagColorMap = {};
    (tagsRes.data || []).forEach((t) => { tagColorMap[t.name] = t.color; });
    libraryMap = {};
    (libRes.data || []).forEach((l) => { libraryMap[l.id] = l.title; });
    nodeLinks = {};
    (linksRes.data || []).forEach((l) => { (nodeLinks[l.node_id] = nodeLinks[l.node_id] || []).push(l.library_item_id); });

    const nodes = nodesRes.data || [];
    const edges = edgesRes.data || [];

    // 初始位置：pinned 用目标坐标，其余随机散布，避免布局完成前节点堆在原点
    const W = $('forest-cy').clientWidth || 800;
    const H = $('forest-cy').clientHeight || 600;

    const elements = [
      ...nodes.map((n) => {
        const position = n.pinned
          ? { x: (n.x - 0.5) * W, y: (n.y - 0.5) * H }
          : { x: (Math.random() * 2 - 1) * W * 0.35, y: (Math.random() * 2 - 1) * H * 0.35 };
        return {
          group: 'nodes',
          position,
          data: {
            id: n.id,
            label: n.label,
            desc: n.desc,
            tags: n.tags || [],
            library_item_id: n.library_item_id || null,
            size: n.size || 30,
            pinned: n.pinned,
            x: n.x,
            y: n.y,
          },
        };
      }),
      ...edges.map((e) => ({
        group: 'edges',
        data: { id: e.id, source: e.source, target: e.target },
      })),
    ];

    const nodeColor = (ele) => {
      const tags = ele.data('tags') || [];
      if (tags.length && tagColorMap[tags[0]]) return tagColorMap[tags[0]];
      return cssVar('--accent');
    };

    const style = [
      {
        selector: 'node',
        style: {
          'background-color': nodeColor,
          'color': () => cssVar('--fg'),
          'border-color': () => cssVar('--border'),
          'border-width': 1,
          'label': 'data(label)',
          'width': 'data(size)',
          'height': 'data(size)',
          'font-size': 12,
          'text-valign': 'center',
          'text-halign': 'center',
        },
      },
      {
        selector: 'edge',
        style: {
          'line-color': () => cssVar('--border'),
          'width': 1,
          'curve-style': 'haystack',
        },
      },
    ];

    cy = window.cytoscape({
      container: $('forest-cy'),
      elements,
      style,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.nodes().ungrabify();

    const constraints = nodes
      .filter((n) => n.pinned)
      .map((n) => ({ nodeId: n.id, position: { x: (n.x - 0.5) * W, y: (n.y - 0.5) * H } }));

    const layout = cy.layout({
      name: 'fcose',
      fixedNodeConstraint: constraints,
      quality: 'default',
      animate: false,
      randomize: true,
    });

    layout.one('layoutstop', () => {
      nodes.filter((n) => n.pinned).forEach((n) => {
        const node = cy.getElementById(n.id);
        if (node && node.length) node.position({ x: (n.x - 0.5) * W, y: (n.y - 0.5) * H });
      });

      // 从图书馆「相关节点」跳转过来时自动定位并打开对应节点（须在布局完成后执行）
      const openNode = localStorage.getItem('cv_open_node');
      if (openNode) {
        localStorage.removeItem('cv_open_node');
        const node = cy.getElementById(openNode);
        if (node && node.length) {
          showNode(node);
          cy.fit(node, 120);
          return;
        }
      }
      cy.fit(undefined, 24);
    });
    layout.run();

    cy.on('tap', 'node', (evt) => showNode(evt.target));
    cy.on('tap', (evt) => {
      if (evt.target === cy) closeNodePanel();
    });
  } catch {
    toastLoadError(loadForest);
  }
}

applyLight(getLight());
loadForest();

const npc = new Npc(document.querySelector('.content-page'));
npc.startIdle();
npc.renderPosition();
