// =====================================================================
// snake.js — 电脑桌上的贪吃蛇小游戏（Canvas）
// 方向键 / WASD 移动，空格暂停；点击「开始游戏」后才开始
// 记录本机最高分 + 历史高分 TOP10 排行榜（进榜时提示昵称）
// =====================================================================

const BEST_KEY = 'cv_snake_best';
const BOARD_KEY = 'cv_snake_board';

export function mountSnake(container) {
  container.innerHTML = '';

  const GRID = 20;
  const CELL = 20;
  const STEP_MS = 150; // 步进间隔，略慢
  const canvas = document.createElement('canvas');
  canvas.width = GRID * CELL;
  canvas.height = GRID * CELL;
  const ctx = canvas.getContext('2d');

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const hud = document.createElement('div');
  hud.style.cssText = 'margin:10px 0 6px;display:flex;gap:14px;align-items:center;';
  const scoreEl = document.createElement('span');
  const bestEl = document.createElement('span');
  const btn = document.createElement('button');
  hud.append(scoreEl, bestEl, btn);

  const hint = document.createElement('div');
  hint.textContent = '方向键 / WASD 移动，空格暂停';
  hint.style.cssText = 'font-size:12px;color:var(--muted);';

  const boardTitle = document.createElement('div');
  boardTitle.textContent = '历史高分 TOP 10';
  boardTitle.style.cssText = 'margin-top:10px;font-size:12px;color:var(--muted);';
  const boardList = document.createElement('div');
  boardList.style.cssText = 'font-size:13px;';

  container.append(canvas, hud, hint, boardTitle, boardList);

  function loadBest() { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; }
  function loadBoard() { try { const b = JSON.parse(localStorage.getItem(BOARD_KEY) || '[]'); return Array.isArray(b) ? b : []; } catch { return []; } }
  function saveBest(v) { localStorage.setItem(BEST_KEY, String(v)); }
  function saveBoard(b) { localStorage.setItem(BOARD_KEY, JSON.stringify(b)); }

  let best = loadBest();
  let board = loadBoard();

  let snake, dir, nextDir, food, score, running, paused, timer;

  function reset() {
    snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    running = false; // 不自动开始，等点「开始游戏」
    paused = false;
    placeFood();
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  }

  function step() {
    if (!running || paused) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hitWall = head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) { gameOver(); return; }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) { score++; placeFood(); }
    else { snake.pop(); }
    draw();
    updateHud();
  }

  function gameOver() {
    running = false;
    clearInterval(timer);

    if (score > 0) {
      const qualifies = board.length < 10 || score > board[board.length - 1].score;
      if (qualifies) {
        const name = (window.prompt('进入排行榜了！请留下昵称：', '') || '').trim().slice(0, 12) || '匿名';
        board.push({ name, score });
        board.sort((a, b) => b.score - a.score);
        board = board.slice(0, 10);
        saveBoard(board);
      }
      if (score > best) { best = score; saveBest(best); }
    }

    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';

    updateHud();
    renderBoard();
  }

  function draw() {
    ctx.fillStyle = cssVar('--bg') || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e07b39';
    ctx.fillRect(food.x * CELL + 1, food.y * CELL + 1, CELL - 2, CELL - 2);

    const headColor = cssVar('--accent') || '#005f5f';
    const bodyColor = cssVar('--fg') || '#1a1a1a';
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? headColor : bodyColor;
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function updateHud() {
    scoreEl.textContent = `分数：${score}`;
    bestEl.textContent = `最高：${best}`;
    btn.textContent = running ? (paused ? '继续' : '暂停') : '开始游戏';
  }

  function renderBoard() {
    boardList.innerHTML = '';
    if (!board.length) {
      boardList.textContent = '还没有记录。';
      return;
    }
    board.forEach((r, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;max-width:220px;';
      const left = document.createElement('span');
      left.textContent = `${i + 1}. ${r.name}`;
      const right = document.createElement('span');
      right.textContent = r.score;
      row.append(left, right);
      boardList.appendChild(row);
    });
  }

  function start() {
    reset();
    running = true;
    clearInterval(timer);
    timer = setInterval(step, STEP_MS);
    updateHud();
    renderBoard();
    draw();
  }

  btn.onclick = () => {
    if (!running) { start(); return; }
    paused = !paused;
    updateHud();
  };

  const onKey = (e) => {
    const k = e.key.toLowerCase();
    let d = null;
    if (k === 'arrowup' || k === 'w') d = { x: 0, y: -1 };
    else if (k === 'arrowdown' || k === 's') d = { x: 0, y: 1 };
    else if (k === 'arrowleft' || k === 'a') d = { x: -1, y: 0 };
    else if (k === 'arrowright' || k === 'd') d = { x: 1, y: 0 };
    else if (k === ' ') {
      e.preventDefault();
      if (running) { paused = !paused; updateHud(); }
      return;
    }
    if (d) {
      e.preventDefault();
      if (!running) { start(); return; } // 首次按方向键也直接开始
      if (!(d.x === -dir.x && d.y === -dir.y)) nextDir = d;
    }
  };
  window.addEventListener('keydown', onKey);

  reset();
  draw();
  updateHud();
  renderBoard();

  return function stop() {
    clearInterval(timer);
    window.removeEventListener('keydown', onKey);
  };
}
