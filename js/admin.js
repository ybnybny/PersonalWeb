// =====================================================================
// admin.js — 后台：登录 + 五个管理 tab（航行日志/图书馆/森林/提问箱/通讯坐标）
// 固定白底黑字，不随灯光；登录态与 RLS 是唯一防线（§10.4）
// =====================================================================
import { supabase } from './supabase.js';
import { el } from './ui.js';

const $ = (id) => document.getElementById(id);

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

function field(label, input) {
  return el('div', { class: 'form-field' }, el('label', {}, label), input);
}

// ---------- Auth ----------

async function initAuth() {
  const { data } = await supabase.auth.getSession();
  renderAuth(!!data.session);
  supabase.auth.onAuthStateChange((_e, session) => renderAuth(!!session));
}

function renderAuth(loggedIn) {
  $('login-view').classList.toggle('hidden', loggedIn);
  $('admin-view').classList.toggle('hidden', !loggedIn);
  if (loggedIn) showTab('profile');
}

$('login-submit').addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    $('login-error').textContent = '登录失败：' + error.message;
  }
});

$('logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

// ---------- Tabs ----------

const TAB_RENDERERS = {
  profile: renderProfile,
  library: renderLibrary,
  forest: renderForest,
  questions: renderQuestions,
  links: renderLinks,
};

document.querySelectorAll('.tab-btn').forEach((b) => {
  b.addEventListener('click', () => showTab(b.dataset.tab));
});

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const content = $('tab-content');
  content.innerHTML = '';
  TAB_RENDERERS[tab](content);
}

// ---------- Markdown 编辑器（textarea + 实时预览 + 插入图片） ----------

function buildMarkdownEditor(initial = '') {
  const textarea = el('textarea', { style: 'width:100%' });
  textarea.value = initial;
  const preview = el('div', { class: 'md-preview markdown-body' });
  const refresh = () => { preview.innerHTML = md(textarea.value); };
  textarea.addEventListener('input', refresh);

  const insertBtn = el('button', { onclick: () => uploadImage(textarea) }, '插入图片');
  const editor = el('div', { class: 'md-editor' }, textarea, preview);
  refresh();
  return { toolbar: el('div', { style: 'margin-bottom:6px' }, insertBtn), editor, getContent: () => textarea.value };
}

async function uploadImage(textarea) {
  const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif' });
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('图片需 ≤5MB'); return; }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `public/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('images').upload(path, file);
    if (error) { alert('上传失败：' + error.message); return; }
    const { data } = supabase.storage.from('images').getPublicUrl(path);
    insertAtCursor(textarea, `![](${data.publicUrl})`);
  };
  input.click();
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
  textarea.dispatchEvent(new Event('input'));
}

// ---------- 1. 航行日志 ----------

async function renderProfile(content) {
  const { data, error } = await supabase.from('profile').select('*').eq('id', 1).single();
  if (error) { content.appendChild(el('div', {}, '加载失败')); return; }

  const spaceId = el('input', { value: data.space_id, style: 'width:100%' });
  const status = el('input', { value: data.status, style: 'width:100%' });
  const affiliation = el('input', { value: data.affiliation, style: 'width:100%' });
  const mdEd = buildMarkdownEditor(data.log_md);

  const save = el('button', {
    onclick: async () => {
      const { error: e } = await supabase.from('profile').update({
        space_id: spaceId.value,
        status: status.value,
        affiliation: affiliation.value,
        log_md: mdEd.getContent(),
      }).eq('id', 1);
      alert(e ? '保存失败' : '已保存');
    },
  }, '保存');

  content.append(
    field('空间编号', spaceId),
    field('当前状态', status),
    field('属空间', affiliation),
    el('label', { style: 'display:block;margin-bottom:4px' }, '航行日志正文（Markdown）'),
    mdEd.toolbar, mdEd.editor,
    el('div', { style: 'margin-top:10px' }, save),
  );
}

// ---------- 2. 图书馆 ----------

async function renderLibrary(content) {
  content.appendChild(el('button', { onclick: () => libraryForm(content) }, '新增'));
  const list = el('div', { style: 'margin-top:10px' });
  content.appendChild(list);

  const { data, error } = await supabase.from('library_items').select('*').order('updated_at', { ascending: false });
  if (error) { list.appendChild(el('div', {}, '加载失败')); return; }

  (data || []).forEach((item) => {
    list.appendChild(el('div', { style: 'border:1px solid #d5d0c8;padding:8px;margin-top:6px' },
      el('div', {}, el('b', {}, item.title), el('span', { style: 'color:#666;font-size:12px' }, '　' + (item.tags || []).join(', '))),
      el('div', { style: 'font-size:12px;color:#666' }, fmtDate(item.updated_at)),
      el('button', { onclick: () => libraryForm(content, item) }, '编辑'),
      el('button', {
        onclick: async () => {
          if (!confirm('确认删除？')) return;
          await supabase.from('library_items').delete().eq('id', item.id);
          renderLibrary(content);
        },
      }, '删除'),
    ));
  });
}

function libraryForm(content, item = null) {
  content.innerHTML = '';
  const title = el('input', { value: item ? item.title : '', style: 'width:100%' });
  const summary = el('input', { value: item ? item.summary : '', style: 'width:100%' });
  const tags = el('input', { value: item ? (item.tags || []).join(', ') : '', placeholder: '标签用逗号分隔，如：作品, 笔记', style: 'width:100%' });
  const mdEd = buildMarkdownEditor(item ? item.content_md : '');

  const save = el('button', {
    onclick: async () => {
      const tagArr = tags.value.split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean);
      const payload = { title: title.value, summary: summary.value, tags: tagArr, content_md: mdEd.getContent() };
      const { error } = item
        ? await supabase.from('library_items').update(payload).eq('id', item.id)
        : await supabase.from('library_items').insert(payload);
      alert(error ? '保存失败' : '已保存');
      renderLibrary(content);
    },
  }, '保存');
  const cancel = el('button', { onclick: () => renderLibrary(content) }, '取消');

  content.append(
    field('标题', title),
    field('摘要（列表显示，留空则省略）', summary),
    field('标签', tags),
    el('label', { style: 'display:block;margin-bottom:4px' }, '正文（Markdown）'),
    mdEd.toolbar, mdEd.editor,
    el('div', { style: 'margin-top:10px' }, save, el('span', { style: 'display:inline-block;width:8px' }), cancel),
  );
}

// ---------- 3. 森林 ----------

let forestCy = null;
let edgeMode = false;
let edgeFirst = null;
let adminTags = [];
let adminLibs = [];
let adminLinks = [];

async function renderForest(content) {
  // fcose 的 UMD 构建只暴露 window.cytoscapeFcose，不会自动注册，需手动注册
  if (window.cytoscape && window.cytoscapeFcose) window.cytoscape.use(window.cytoscapeFcose);
  content.innerHTML = '';
  const toolbar = el('div', { style: 'margin-bottom:8px' },
    el('button', { onclick: () => forestAddNode(content) }, '新增节点'),
    el('button', { onclick: () => forestEditNode(content) }, '编辑选中'),
    el('button', { onclick: () => forestDeleteNode(content) }, '删除选中'),
    el('button', { onclick: () => forestUnpinNode(content) }, '取消固定'),
    el('button', { id: 'edge-mode-btn', onclick: () => toggleEdgeMode() }, '连线模式：关'),
    el('button', { onclick: () => forestTagManage(content) }, '标签管理'),
  );
  const cyEl = el('div', { id: 'admin-cy', style: 'width:100%;height:480px;border:1px solid #d5d0c8' });
  content.append(toolbar, cyEl);

  const [nodesRes, edgesRes, tagsRes, libsRes, linksRes] = await Promise.all([
    supabase.from('knowledge_nodes').select('*'),
    supabase.from('knowledge_edges').select('*'),
    supabase.from('knowledge_tags').select('*'),
    supabase.from('library_items').select('id, title'),
    supabase.from('knowledge_node_links').select('node_id, library_item_id'),
  ]);
  if (nodesRes.error || edgesRes.error) { content.appendChild(el('div', {}, '加载失败')); return; }

  const nodes = nodesRes.data || [];
  const edges = edgesRes.data || [];
  adminTags = tagsRes.data || [];
  adminLibs = libsRes.data || [];
  adminLinks = linksRes.data || [];

  const colorOf = (tags) => {
    if (!tags || !tags.length) return '#005f5f';
    const t = adminTags.find((x) => x.name === tags[0]);
    return t ? t.color : '#005f5f';
  };

  forestCy = window.cytoscape({
    container: cyEl,
    elements: [
      ...nodes.map((n) => ({ group: 'nodes', data: { id: n.id, label: n.label, desc: n.desc, tags: n.tags || [], library_item_id: n.library_item_id || null, size: n.size || 30, pinned: n.pinned, x: n.x, y: n.y } })),
      ...edges.map((e) => ({ group: 'edges', data: { id: e.id, source: e.source, target: e.target } })),
    ],
    style: [
      { selector: 'node', style: { 'background-color': (ele) => colorOf(ele.data('tags')), 'color': '#1a1a1a', 'label': 'data(label)', 'width': 'data(size)', 'height': 'data(size)', 'font-size': 12, 'text-valign': 'center', 'text-halign': 'center' } },
      { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#b3261e' } },
      { selector: 'edge', style: { 'line-color': '#d5d0c8', 'width': 1.5, 'curve-style': 'haystack' } },
    ],
  });

  const W = cyEl.clientWidth || 800;
  const H = cyEl.clientHeight || 480;
  const constraints = nodes.filter((n) => n.pinned).map((n) => ({ nodeId: n.id, position: { x: (n.x - 0.5) * W, y: (n.y - 0.5) * H } }));

  const layout = forestCy.layout({ name: 'fcose', fixedNodeConstraint: constraints, quality: 'default', animate: false, randomize: true });
  layout.one('layoutstop', () => {
    nodes.filter((n) => n.pinned).forEach((n) => {
      const node = forestCy.getElementById(n.id);
      if (node && node.length) node.position({ x: (n.x - 0.5) * W, y: (n.y - 0.5) * H });
    });
    forestCy.fit(undefined, 24);
  });
  layout.run();

  // 后台可拖节点写坐标（松手后换算 0–1 并置 pinned）
  forestCy.nodes().grabify();
  forestCy.on('dragfree', 'node', async (evt) => {
    const n = evt.target;
    const pos = n.position();
    const x = Math.min(1, Math.max(0, pos.x / W + 0.5));
    const y = Math.min(1, Math.max(0, pos.y / H + 0.5));
    n.data('pinned', true);
    n.data('x', x); n.data('y', y);
    const { error } = await supabase.from('knowledge_nodes').update({ x, y, pinned: true }).eq('id', n.id());
    if (error) alert('坐标保存失败');
  });

  forestCy.on('tap', 'node', (evt) => {
    const n = evt.target;
    if (edgeMode) {
      if (!edgeFirst) { edgeFirst = n; n.addClass('selected'); return; }
      if (edgeFirst.id() === n.id()) return;
      toggleEdge(edgeFirst.id(), n.id(), content);
      edgeFirst = null;
      return;
    }
  });
}

async function toggleEdge(a, b, content) {
  const existing = forestCy.edges().filter((e) =>
    (e.data('source') === a && e.data('target') === b) || (e.data('source') === b && e.data('target') === a));
  if (existing.length) {
    await supabase.from('knowledge_edges').delete().eq('id', existing[0].id());
  } else {
    await supabase.from('knowledge_edges').insert({ source: a, target: b });
  }
  renderForest(content);
}

function toggleEdgeMode() {
  edgeMode = !edgeMode;
  edgeFirst = null;
  $('edge-mode-btn').textContent = `连线模式：${edgeMode ? '开' : '关'}`;
}

function forestNodeForm(content, node = null) {
  content.innerHTML = '';
  const nodeId = node ? node.id() : null;
  const label = el('input', { value: node ? node.data('label') : '', style: 'width:100%' });

  // 简介：Markdown 编辑器（textarea + 实时预览，支持代码块）
  const mdEd = buildMarkdownEditor(node ? (node.data('desc') || '') : '');

  const tags = el('input', { value: node ? (node.data('tags') || []).join(', ') : '', placeholder: '标签用逗号分隔，颜色在「标签管理」里设置', style: 'width:100%' });

  // 关联文章：多选复选框
  const linked = node ? new Set(adminLinks.filter((x) => x.node_id === nodeId).map((x) => x.library_item_id)) : new Set();
  const linkBox = el('div', { style: 'max-height:160px;overflow:auto;border:1px solid #d5d0c8;padding:8px;' });
  const checkboxes = [];
  if (!adminLibs.length) {
    linkBox.appendChild(el('div', { style: 'color:#666' }, '（图书馆还没有文章）'));
  }
  adminLibs.forEach((l) => {
    const cb = el('input', { type: 'checkbox', value: l.id });
    cb.checked = linked.has(l.id);
    checkboxes.push(cb);
    linkBox.appendChild(el('label', { style: 'display:flex;align-items:center;gap:6px;margin-bottom:4px' }, cb, l.title));
  });

  const save = el('button', {
    onclick: async () => {
      const tagArr = tags.value.split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean);
      const payload = { label: label.value, desc: mdEd.getContent(), tags: tagArr };
      let id = nodeId;
      if (node) {
        const { error } = await supabase.from('knowledge_nodes').update(payload).eq('id', nodeId);
        if (error) { alert('保存失败'); return; }
      } else {
        const { data: row, error } = await supabase.from('knowledge_nodes').insert({ ...payload, x: 0.5, y: 0.5, pinned: false, size: 30 }).select('id').single();
        if (error) { alert('保存失败'); return; }
        id = row.id;
      }
      // 关联文章：先删后插
      await supabase.from('knowledge_node_links').delete().eq('node_id', id);
      const links = checkboxes.filter((c) => c.checked).map((c) => ({ node_id: id, library_item_id: c.value }));
      if (links.length) await supabase.from('knowledge_node_links').insert(links);
      alert('已保存');
      renderForest(content);
    },
  }, '保存');
  const cancel = el('button', { onclick: () => renderForest(content) }, '取消');
  content.append(
    field('节点名称', label),
    el('label', { style: 'display:block;margin-bottom:4px' }, '简介（Markdown，支持代码块）'),
    mdEd.toolbar, mdEd.editor,
    field('标签', tags),
    el('label', { style: 'display:block;margin-bottom:4px' }, '关联图书馆文章（可多选）'),
    linkBox,
    el('div', { style: 'margin-top:10px' }, save, el('span', { style: 'display:inline-block;width:8px' }), cancel),
  );
}

async function forestAddNode(content) {
  forestNodeForm(content);
}

async function forestEditNode(content) {
  const sel = forestCy.$('node:selected');
  if (!sel.length) { alert('请先点击选中一个节点'); return; }
  forestNodeForm(content, sel[0]);
}

function forestTagManage(content) {
  content.innerHTML = '';
  const list = el('div', { style: 'margin-bottom:12px' });
  adminTags.forEach((t) => {
    const colorInput = el('input', { type: 'color', value: t.color, style: 'width:52px;padding:0;border:none' });
    colorInput.addEventListener('change', async () => {
      const { error } = await supabase.from('knowledge_tags').update({ color: colorInput.value }).eq('name', t.name);
      if (!error) renderForest(content);
      else alert('保存失败');
    });
    list.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:6px' },
      el('b', {}, t.name),
      colorInput,
      el('button', { onclick: async () => { if (confirm(`删除标签「${t.name}」？`)) { await supabase.from('knowledge_tags').delete().eq('name', t.name); renderForest(content); } } }, '删除'),
    ));
  });

  const newName = el('input', { placeholder: '新标签名', style: 'width:140px' });
  const newColor = el('input', { type: 'color', value: '#005f5f', style: 'width:52px;padding:0;border:none' });
  const addBtn = el('button', {
    onclick: async () => {
      const name = newName.value.trim();
      if (!name) { alert('请填标签名'); return; }
      const { error } = await supabase.from('knowledge_tags').upsert({ name, color: newColor.value });
      if (error) alert('保存失败');
      renderForest(content);
    },
  }, '添加');

  content.append(
    el('h3', { style: 'font-size:14px' }, '标签管理（改颜色后节点会同步变色）'),
    list,
    el('div', { style: 'display:flex;gap:8px;align-items:center' }, newName, newColor, addBtn),
    el('div', { style: 'margin-top:12px' }, el('button', { onclick: () => renderForest(content) }, '返回森林')),
  );
}

async function forestDeleteNode(content) {
  const sel = forestCy.$('node:selected');
  if (!sel.length) { alert('请先点击选中一个节点'); return; }
  if (!confirm('删除该节点及其连线？')) return;
  await supabase.from('knowledge_nodes').delete().eq('id', sel[0].id());
  renderForest(content);
}

async function forestUnpinNode(content) {
  const sel = forestCy.$('node:selected');
  if (!sel.length) { alert('请先点击选中一个节点'); return; }
  await supabase.from('knowledge_nodes').update({ pinned: false }).eq('id', sel[0].id());
  renderForest(content);
}

// ---------- 4. 提问箱 ----------

async function renderQuestions(content) {
  const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
  if (error) { content.appendChild(el('div', {}, '加载失败')); return; }

  (data || []).forEach((q) => {
    const answerTa = el('textarea', { rows: '3', maxlength: '500', style: 'width:100%' });
    answerTa.value = q.answer || '';

    const card = el('div', { style: 'border:1px solid #d5d0c8;padding:10px;margin-top:8px' },
      el('div', {}, el('b', {}, q.content)),
      el('div', { style: 'font-size:12px;color:#666' },
        `留言人：${q.submitter_name || '匿名'} · 邮箱：${q.submitter_email || '—'} · 可见：${q.display_mode} · 状态：${q.status} · ${fmtDate(q.created_at)}`),
      field('回答（纯文本，≤500 字）', answerTa),
      el('div', {},
        el('button', {
          onclick: async () => {
            const { error: e } = await supabase.from('questions').update({ status: 'published', display_mode: 'public', answer: answerTa.value, answered_at: new Date().toISOString() }).eq('id', q.id);
            alert(e ? '操作失败' : '已发布并回答');
            renderQuestions(content);
          },
        }, '发布并回答'),
        el('button', { onclick: async () => { await supabase.from('questions').update({ display_mode: 'private' }).eq('id', q.id); renderQuestions(content); } }, '设为私密'),
        el('button', { onclick: async () => { await supabase.from('questions').update({ display_mode: 'public' }).eq('id', q.id); renderQuestions(content); } }, '设为公开'),
        el('button', { onclick: async () => { await supabase.from('questions').update({ status: 'rejected' }).eq('id', q.id); renderQuestions(content); } }, '拒绝'),
      ),
    );
    content.appendChild(card);
  });
}

// ---------- 5. 通讯坐标 ----------

async function renderLinks(content) {
  content.appendChild(el('button', { onclick: () => linkForm(content) }, '新增友链'));
  const list = el('div', { style: 'margin-top:10px' });
  content.appendChild(list);

  const { data, error } = await supabase.from('friend_links').select('*').order('sort_order').order('created_at');
  if (error) { list.appendChild(el('div', {}, '加载失败')); return; }

  (data || []).forEach((f, i) => {
    list.appendChild(el('div', { style: 'border:1px solid #d5d0c8;padding:8px;margin-top:6px' },
      el('div', {}, el('b', {}, f.name), el('span', { style: 'color:#666;font-size:12px' }, '　' + f.url)),
      f.desc ? el('div', { style: 'font-size:12px;color:#666' }, f.desc) : null,
      el('button', { onclick: () => linkForm(content, f) }, '编辑'),
      el('button', { onclick: async () => { if (confirm('删除？')) { await supabase.from('friend_links').delete().eq('id', f.id); renderLinks(content); } } }, '删除'),
      el('button', { onclick: () => moveLink(f, 'up') }, '↑'),
      el('button', { onclick: () => moveLink(f, 'down') }, '↓'),
    ));
  });
}

async function moveLink(f, dir) {
  const { data } = await supabase.from('friend_links').select('*').order('sort_order');
  const idx = (data || []).findIndex((x) => x.id === f.id);
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= (data || []).length) return;
  const a = data[idx], b = data[swapIdx];
  await supabase.from('friend_links').update({ sort_order: b.sort_order }).eq('id', a.id);
  await supabase.from('friend_links').update({ sort_order: a.sort_order }).eq('id', b.id);
  renderLinks($('tab-content'));
}

function linkForm(content, f = null) {
  content.innerHTML = '';
  const name = el('input', { value: f ? f.name : '', style: 'width:100%' });
  const url = el('input', { value: f ? f.url : '', placeholder: 'https://...', style: 'width:100%' });
  const desc = el('input', { value: f ? f.desc : '', style: 'width:100%' });
  const save = el('button', {
    onclick: async () => {
      const payload = { name: name.value, url: url.value, desc: desc.value };
      const { error } = f
        ? await supabase.from('friend_links').update(payload).eq('id', f.id)
        : await supabase.from('friend_links').insert(payload);
      alert(error ? '保存失败' : '已保存');
      renderLinks(content);
    },
  }, '保存');
  const cancel = el('button', { onclick: () => renderLinks(content) }, '取消');
  content.append(field('名称', name), field('地址', url), field('描述', desc), el('div', { style: 'margin-top:10px' }, save, el('span', { style: 'display:inline-block;width:8px' }), cancel));
}

// ---------- 启动 ----------

initAuth();
