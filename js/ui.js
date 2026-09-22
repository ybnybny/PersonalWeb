// 共享 UI 工具：DOM 辅助、toast、安全文本渲染（内容页使用；边栏由 shell.js 负责）

// 创建元素：el('div', {class:'x', id:'y'}, child1, 'text', ...)
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// 安全设置纯文本（防 XSS，§9）
export function setText(node, text) {
  node.textContent = text == null ? '' : String(text);
  return node;
}

let toastWrap = null;
function ensureToastWrap() {
  if (!toastWrap) {
    toastWrap = el('div', { class: 'toast-wrap' });
    document.body.appendChild(toastWrap);
  }
  return toastWrap;
}

// toast：错误提示，支持可选「重试」回调（§10 全站错误处理约定）
export function toast(message, { action, duration = 3200 } = {}) {
  const wrap = ensureToastWrap();
  const t = el('div', { class: 'toast' }, message);
  if (action) {
    const btn = el('button', { class: 'toast-action', onclick: () => { action(); t.remove(); } }, '重试');
    t.appendChild(document.createTextNode(' '));
    t.appendChild(btn);
  }
  wrap.appendChild(t);
  const remove = () => { if (t.parentNode) t.remove(); };
  setTimeout(remove, duration);
  return remove;
}

// 读取失败的统一提示与重试（§10）
export function toastLoadError(retry) {
  return toast('数据加载失败，请稍后重试', { action: retry });
}
