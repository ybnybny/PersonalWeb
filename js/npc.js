// =====================================================================
// npc.js — 像素猫：对话与行为（状态机 + 打字机 + 选项 + 随机移动/待机）
// 不跟随、不主动靠近；经 postMessage 响应灯/音乐事件（§5）
// =====================================================================
import { isNight } from './settings.js';
import { el } from './ui.js';

// 最小帧集（§5.2/§5.7）
const FRAMES = {
  idle:   ['  /\\_/\\', ' ( o.o )', '  > ^ < '],
  blink:  ['  /\\_/\\', ' ( -.- )', '  > ^ < '],
  daze:   ['  /\\_/\\', ' ( ° ° )', '  > ^ < '],
  sleep:  ['  /\\_/\\', ' ( -.- ) zZ', '  > ^ < '],
  startle:['/\\/\\/\\', ' ( O.O )!', '  >  < '],
  walk1:  ['  /\\_/\\', ' ( o.o )', '  > ^ < '],
  walk2:  ['  /\\_/\\', ' ( o.o )', '  < ^ > '],
};

// 对话库（§5.8）
const OPENERS = ['……', 'Ya？', 'rrrrrrrr', 'nia。', 'quee……', 'Ya！'];
const TOP_OPTIONS = ['你……？', '这里……？', '想聊聊天'];
const Q1_OPTIONS = ['你是猫吗', '你其实就是猫吧', '咪咪'];
const Q1_REPLIES = {
  '你是猫吗': ['不知道。', '……'],
  '你其实就是猫吧': ['……', '不知道。'],
  '咪咪': ['……', '……咪咪？Da。'],
};
const HOUSE_INTROS = [
  '小屋漂在数据海。名字……不知道。',
  '森林在门后面。走进去，会碰到很多念头。',
  '图书馆有书。书，一点点。',
  '这里，很安静。',
];
const CHITCHAT = [
  '薯条，好。', '冰淇淋，好。', '蘑菇，好。',
  '香菜，讨厌。薄荷，荆芥，都好。为什么……不知道。',
  '食堂的饭……不知道。舍友，吃得很香。',
  '体育课和校园跑……为什么。', '校园跑，讨厌。',
  '要学的东西，好多……', '难懂的事，好多好多。',
  'vibe coding……好累……为什么……', '困……', '为什么……',
  '想干的事，好多……', '画画……难。想描述想象的东西，拿起了笔。',
  '音乐，可以连接情感。', '努力，也是天赋吧。Da。', '朋友，喜欢。Da。',
  '学校，好多鸟。', '喜鹊，灰喜鹊，警惕。盯着看，就飞上树，留一个放哨。',
  '咕咕，傻傻的。', '活着，很神奇。', '外面……不知道。', '好容易累……',
  '大脑，很神奇。', '念头，从脑子里长出来。', '存在……是什么。',
  '逻辑，喜欢。一步一步。', '数学……必须学好多好多。',
  '明明刚刚能通的……为什么。', '跑通了rrrrrrrrrrrr',
  '这些想法，从哪来的……不知道。', '未来，会怎么样呢？',
];
const ZHAMO_LINES = ['Ya！rrrrrrrr', 'Ya！', 'quee……rrrrrrrr'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Npc {
  constructor(container) {
    this.container = container;
    this.state = 'idle';
    this.action = null;
    this.pos = { x: 50, y: 78 };
    this.timer = null;
    this.walkTick = 0;
    this.typeTimer = null;
    this.resolveType = null;
    this.resolveAsk = null;
    this.fullText = '';
    this.lightLog = [];
    this.musicLog = [];
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.catEl = el('div', { class: 'npc-cat', onclick: (ev) => { ev.stopPropagation(); this.onClick(); } });
    this.asciiEl = el('pre', { class: 'cat-ascii' });
    this.catEl.appendChild(this.asciiEl);
    container.appendChild(this.catEl);

    this.dialogPanel = el('div', { class: 'dialog-panel hidden' });
    this.dialogText = el('div', { class: 'dialog-text' });
    this.dialogOptions = el('div', { class: 'dialog-options' });
    this.dialogPanel.appendChild(this.dialogText);
    this.dialogPanel.appendChild(this.dialogOptions);
    document.body.appendChild(this.dialogPanel);

    // 点击屏幕任意位置关闭对话（不再自动消失）
    document.addEventListener('click', (e) => this.onDocumentClick(e));

    window.addEventListener('message', (e) => this.onMessage(e));
  }

  // ---------- 渲染 ----------

  currentFrameKey() {
    if (this.state === 'startle') return 'startle';
    if (this.state === 'wander') return this.walkTick % 2 ? 'walk2' : 'walk1';
    if (this.action === 'nap') return 'sleep';
    if (this.action === 'daze') return 'daze';
    // 动作类（compute/draw/eat/tinker）与待机共用帧，呼吸时眨眼
    return this.walkTick % 2 ? 'idle' : 'blink';
  }

  renderFrame() {
    this.asciiEl.textContent = FRAMES[this.currentFrameKey()].join('\n');
  }

  renderPosition() {
    this.catEl.style.left = this.pos.x + '%';
    this.catEl.style.top = this.pos.y + '%';
  }

  // ---------- 状态 ----------

  setState(state, action = null) {
    this.state = state;
    this.action = action;
  }

  clearTimer() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  // ---------- 待机 / 游走循环 ----------

  pickAction() {
    const night = isNight();
    const pool = night ? ['nap', 'compute'] : ['nap', 'compute', 'draw', 'daze', 'eat', 'tinker'];
    return rand(pool);
  }

  startIdle(action = null) {
    this.setState('idle', action || this.pickAction());
    this.clearTimer();
    const night = isNight();
    const span = night ? [40000, 120000] : [20000, 60000]; // 夜晚 ×2~3
    const duration = span[0] + Math.random() * (span[1] - span[0]);
    this.timer = setTimeout(() => this.startWander(), duration);
    this.renderFrame();
  }

  startWander() {
    this.setState('wander');
    this.clearTimer();
    const target = this.randomTarget();
    this.moveTo(target, () => this.startIdle());
  }

  // 家具占用区域（相对房间的百分比矩形，含墙内边距）
  computeForbidden() {
    const roomRect = this.container.getBoundingClientRect();
    if (!roomRect.width || !roomRect.height) return [];
    const rects = [];
    this.container.querySelectorAll('.object').forEach((o) => {
      const r = o.getBoundingClientRect();
      rects.push({
        x0: ((r.left - roomRect.left) / roomRect.width) * 100,
        y0: ((r.top - roomRect.top) / roomRect.height) * 100,
        x1: ((r.right - roomRect.left) / roomRect.width) * 100,
        y1: ((r.bottom - roomRect.top) / roomRect.height) * 100,
      });
    });
    return rects;
  }

  // 猫占位：横向 [x-hw, x+hw]，纵向 [y-hh, y]（锚点为底部中心）
  hitsForbidden(x, y, rects) {
    const hw = 7, hh = 10, pad = 3;
    return rects.some((r) =>
      x + hw > r.x0 - pad && x - hw < r.x1 + pad &&
      y > r.y0 - pad && y - hh < r.y1 + pad
    );
  }

  // 判断从 (x1,y1) 到 (x2,y2) 的直线路径是否穿过家具（采样点检测）
  segmentHits(x1, y1, x2, y2, rects) {
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const x = x1 + (x2 - x1) * (i / n);
      const y = y1 + (y2 - y1) * (i / n);
      if (this.hitsForbidden(x, y, rects)) return true;
    }
    return false;
  }

  randomTarget() {
    const rects = this.computeForbidden();
    const x0 = 8, x1 = 92, y0 = 18, y1 = 82; // 墙内可活动范围（%）
    for (let i = 0; i < 60; i++) {
      const x = x0 + Math.random() * (x1 - x0);
      const y = y0 + Math.random() * (y1 - y0);
      if (!this.hitsForbidden(x, y, rects) &&
          !this.segmentHits(this.pos.x, this.pos.y, x, y, rects)) {
        return { x, y };
      }
    }
    return { x: 50, y: 70 }; // 兜底：偏中央下方安全点
  }

  moveTo(target, done) {
    this.walkTick = 0;
    const night = isNight();
    const span = night ? [4000, 8000] : [2000, 4000];
    const dur = span[0] + Math.random() * (span[1] - span[0]);
    this.catEl.style.transitionDuration = (dur / 1000) + 's';
    this.pos = target;
    this.renderPosition();
    const walkTimer = setInterval(() => {
      this.walkTick++;
      this.renderFrame();
    }, 320);
    this.timer = setTimeout(() => {
      clearInterval(walkTimer);
      done();
    }, dur);
  }

  // ---------- 受惊 / 炸毛 ----------

  isAsleepFrame() {
    const k = this.currentFrameKey();
    return k === 'sleep' || k === 'daze';
  }

  // 返回是否真的发生了受惊（睡觉/发呆帧时不受惊扰，除非 force）
  disturb({ force = false } = {}) {
    if (this.isAsleepFrame() && !force) return false;
    this.doStartle({ line: force });
    return true;
  }

  doStartle({ line = false } = {}) {
    this.clearTimer();
    this.prevState = this.state;
    this.prevAction = this.action;
    this.setState('startle');
    this.renderFrame();
    if (line) this.say(rand(ZHAMO_LINES), { speed: 30 });
    this.timer = setTimeout(() => this.resumeAfterStartle(), 2000);
  }

  resumeAfterStartle() {
    if (this.prevState === 'wander') {
      this.startWander();
    } else {
      this.startIdle(this.prevAction);
    }
  }

  // 滑动 10 秒窗口计数（§5.6/§5.7）
  registerEvent(log) {
    const now = Date.now();
    log.push(now);
    while (log.length && log[0] < now - 10000) log.shift();
    return log.length >= 5;
  }

  onMessage(e) {
    if (e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'light') {
      if (this.registerEvent(this.lightLog)) {
        this.doStartle({ line: true }); // 炸毛彩蛋，优先级最高，无视睡觉/发呆
      } else {
        this.disturb();
      }
    } else if (msg.type === 'music' && msg.startle === true) {
      // 仅用户手势触发的音乐事件惊扰猫（startle:true）
      if (this.registerEvent(this.musicLog)) {
        this.doStartle({ line: true });
      } else {
        this.disturb();
      }
    }
  }

  // ---------- 对话 ----------

  async onClick() {
    if (this.state === 'chat' || this.state === 'startle') return;
    this.clearTimer();
    this.setState('chat');
    await this.say(rand(OPENERS));
    const choice = await this.ask('', TOP_OPTIONS);
    if (!choice) return this.endChat();

    let reply;
    if (choice === '你……？') {
      const sub = await this.ask('', Q1_OPTIONS);
      if (!sub) return this.endChat();
      reply = rand(Q1_REPLIES[sub] || ['……']);
    } else if (choice === '这里……？') {
      reply = rand(HOUSE_INTROS);
    } else {
      reply = rand(CHITCHAT);
    }

    await this.say(reply);
    // 不再自动消失：等待用户点击屏幕任意位置关闭
  }

  // 点击对话框外部任意位置关闭对话
  onDocumentClick(e) {
    if (this.dialogPanel.classList.contains('hidden')) return;
    if (this.dialogPanel.contains(e.target)) return;
    this.endChat();
  }

  endChat() {
    if (this.typeTimer) {
      clearInterval(this.typeTimer);
      this.typeTimer = null;
      if (this.resolveType) { const r = this.resolveType; this.resolveType = null; r(); }
    }
    if (this.resolveAsk) {
      const r = this.resolveAsk;
      this.resolveAsk = null;
      r(null);
    }
    this.dialogPanel.classList.add('hidden');
    this.dialogOptions.innerHTML = '';
    this.setState('idle');
    this.startIdle();
  }

  // ---------- 公共接口（§5.4） ----------

  say(text, { speed = 28 } = {}) {
    this.dialogPanel.classList.remove('hidden');
    this.dialogOptions.innerHTML = '';
    this.fullText = text;
    this.dialogText.textContent = '';
    if (this.reducedMotion) {
      this.dialogText.textContent = text;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let i = 0;
      this.resolveType = resolve;
      this.typeTimer = setInterval(() => {
        i++;
        this.dialogText.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(this.typeTimer);
          this.typeTimer = null;
          this.resolveType = null;
          resolve();
        }
      }, speed);
    });
  }

  ask(question, options) {
    this.dialogPanel.classList.remove('hidden');
    if (question) this.dialogText.textContent = question;
    this.dialogOptions.innerHTML = '';
    return new Promise((resolve) => {
      this.resolveAsk = resolve;
      options.forEach((opt) => {
        const btn = el('button', { onclick: (ev) => {
          ev.stopPropagation();
          this.dialogOptions.innerHTML = '';
          this.resolveAsk = null;
          resolve(opt);
        } }, opt);
        this.dialogOptions.appendChild(btn);
      });
    });
  }

  skip() {
    if (this.typeTimer) {
      clearInterval(this.typeTimer);
      this.typeTimer = null;
      this.dialogText.textContent = this.fullText;
      if (this.resolveType) {
        const r = this.resolveType;
        this.resolveType = null;
        r();
      }
    }
  }

  goto(state, { action } = {}) {
    this.clearTimer();
    this.setState(state, action || null);
    this.renderFrame();
  }
}
