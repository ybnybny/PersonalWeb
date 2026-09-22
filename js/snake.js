// =====================================================================
// snake.js — 电脑桌上的贪吃蛇小游戏（Canvas）
// 方向键 / WASD 移动，空格暂停；零依赖
// =====================================================================

export function mountSnake(container) {
  container.innerHTML = '';

  const GRID = 20;
  const CELL = 20;
  const canvas = document.createElement('canvas');
  canvas.width = GRID * CELL;
  canvas.height = GRID * CELL;
  const ctx = canvas.getContext('2d');

  const hud = document.createElement('div');
  hud.style.cssText = 'margin:10px 0 6px;display:flex;gap:14px;align-items:center;';
  const scoreEl = document.createElement('span');
  const btn = document.createElement('button');
  hud.append(scoreEl, btn);

  const hint = document.createElement('div');
  hint.textContent = '方向键 / WASD 移动，空格暂停';
  hint.style.cssText = 'font-size:12px;color:var(--muted);';

  container.append(canvas, hud, hint);

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  let snake, dir, nextDir, food, score, running, paused, timer;

  function reset() {
    snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    running = true;
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
    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
    btn.textContent = '重新开始';
  }

  function draw() {
    ctx.fillStyle = cssVar('--bg') || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 食物
    ctx.fillStyle = '#e07b39';
    ctx.fillRect(food.x * CELL + 1, food.y * CELL + 1, CELL - 2, CELL - 2);

    // 蛇
    const headColor = cssVar('--accent') || '#005f5f';
    const bodyColor = cssVar('--fg') || '#1a1a1a';
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? headColor : bodyColor;
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function updateHud() {
    scoreEl.textContent = `分数：${score}`;
    btn.textContent = running ? (paused ? '继续' : '暂停') : '重新开始';
  }

  function start() {
    reset();
    clearInterval(timer);
    timer = setInterval(step, 130);
    updateHud();
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
      // 禁止 180° 反向
      if (!(d.x === -dir.x && d.y === -dir.y)) nextDir = d;
    }
  };
  window.addEventListener('keydown', onKey);

  start();

  return function stop() {
    clearInterval(timer);
    window.removeEventListener('keydown', onKey);
  };
}
