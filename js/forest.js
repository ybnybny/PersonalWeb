// =====================================================================
// forest.js — 森林：知识图谱（Cytoscape.js + fcose）
// 公开页：平移/缩放/点击展开，节点不可拖动
// =====================================================================
import { supabase } from './supabase.js';
import { getLight } from './settings.js';
import { toastLoadError } from './ui.js';
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

async function loadForest() {
  try {
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from('knowledge_nodes').select('*'),
      supabase.from('knowledge_edges').select('*'),
    ]);
    if (nodesRes.error) throw nodesRes.error;
    if (edgesRes.error) throw edgesRes.error;

    const nodes = nodesRes.data || [];
    const edges = edgesRes.data || [];

    const elements = [
      ...nodes.map((n) => ({
        group: 'nodes',
        data: {
          id: n.id,
          label: n.label,
          desc: n.desc,
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

    const style = [
      {
        selector: 'node',
        style: {
          'background-color': () => cssVar('--accent'),
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

    // 公开页禁用节点拖动
    cy.nodes().ungrabify();

    // fcose 布局：pinned 节点用 fixedNodeConstraint 固定
    const W = $('forest-cy').clientWidth || 800;
    const H = $('forest-cy').clientHeight || 600;
    const constraints = nodes
      .filter((n) => n.pinned)
      .map((n) => ({
        nodeId: n.id,
        position: { x: (n.x - 0.5) * W, y: (n.y - 0.5) * H },
      }));

    const layout = cy.layout({
      name: 'fcose',
      fixedNodeConstraint: constraints,
      quality: 'default',
      animate: false,
      randomize: true,
    });

    layout.one('layoutstop', () => {
      // 布局后再精确固定 pinned 节点位置（兜底校准）
      nodes.filter((n) => n.pinned).forEach((n) => {
        const node = cy.getElementById(n.id);
        if (node && node.length) {
          node.position({ x: (n.x - 0.5) * W, y: (n.y - 0.5) * H });
        }
      });
      cy.fit(undefined, 24);
    });
    layout.run();

    cy.on('tap', 'node', (evt) => {
      const n = evt.target;
      $('node-label').textContent = n.data('label') || '';
      $('node-desc').textContent = n.data('desc') || '';
      $('forest-side').classList.add('show');
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) $('forest-side').classList.remove('show');
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
