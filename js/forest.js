// =====================================================================
// forest.js — 森林：知识图谱（Cytoscape.js + fcose）
// 公开页：平移/缩放/点击展开，节点不可拖动
// =====================================================================
import { supabase } from './supabase.js';
import { getLight } from './settings.js';
import { el, toastLoadError } from './ui.js';
import { Npc } from './npc.js';

const $ = (id) => document.getElementById(id);

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

let cy = null;
let tagColorMap = {};
let libraryMap = {};

function showNode(node) {
  const d = node.data();
  $('node-label').textContent = d.label || '';
  $('node-desc').textContent = d.desc || '';

  const tagsWrap = $('node-tags');
  tagsWrap.innerHTML = '';
  (d.tags || []).forEach((t) => {
    const color = tagColorMap[t];
    tagsWrap.appendChild(el('span', { class: 'tag-chip', style: color ? `background:${color}` : '' }, t));
  });

  const linkWrap = $('node-link');
  linkWrap.innerHTML = '';
  if (d.library_item_id && libraryMap[d.library_item_id]) {
    linkWrap.appendChild(el('div', { style: 'border-top:1px dashed var(--border);padding-top:8px;' },
      el('div', { style: 'font-size:12px;color:var(--muted)' }, '相关文章'),
      el('div', { style: 'margin:4px 0' }, libraryMap[d.library_item_id]),
      el('button', { onclick: () => openLibraryItem(d.library_item_id) }, '前往图书馆查看'),
    ));
  }

  $('forest-side').classList.add('show');
}

function openLibraryItem(itemId) {
  localStorage.setItem('cv_open_item', itemId);
  window.parent.postMessage({ type: 'navigate', room: 'library' }, location.origin);
}

async function loadForest() {
  try {
    const [nodesRes, edgesRes, tagsRes, libRes] = await Promise.all([
      supabase.from('knowledge_nodes').select('*'),
      supabase.from('knowledge_edges').select('*'),
      supabase.from('knowledge_tags').select('*'),
      supabase.from('library_items').select('id, title'),
    ]);
    if (nodesRes.error) throw nodesRes.error;
    if (edgesRes.error) throw edgesRes.error;

    tagColorMap = {};
    (tagsRes.data || []).forEach((t) => { tagColorMap[t.name] = t.color; });
    libraryMap = {};
    (libRes.data || []).forEach((l) => { libraryMap[l.id] = l.title; });

    const nodes = nodesRes.data || [];
    const edges = edgesRes.data || [];

    const elements = [
      ...nodes.map((n) => ({
        group: 'nodes',
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
      })),
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

    const W = $('forest-cy').clientWidth || 800;
    const H = $('forest-cy').clientHeight || 600;
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
      cy.fit(undefined, 24);
    });
    layout.run();

    cy.on('tap', 'node', (evt) => showNode(evt.target));
    cy.on('tap', (evt) => {
      if (evt.target === cy) $('forest-side').classList.remove('show');
    });

    // 从图书馆「相关节点」跳转过来时自动打开对应节点
    const openNode = localStorage.getItem('cv_open_node');
    if (openNode) {
      localStorage.removeItem('cv_open_node');
      const node = cy.getElementById(openNode);
      if (node && node.length) {
        showNode(node);
        cy.animate({ fit: { eles: node, padding: 120 }, duration: 300 });
      }
    }
  } catch {
    toastLoadError(loadForest);
  }
}

applyLight(getLight());
loadForest();

const npc = new Npc(document.querySelector('.content-page'));
npc.startIdle();
npc.renderPosition();
