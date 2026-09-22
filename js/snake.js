// =====================================================================
// snake.js — 电脑桌上的贪吃蛇小游戏（Canvas）
// 方向键 / WASD 移动，空格暂停；本机最高分 + 前十排行榜（localStorage）
// =====================================================================
import { el } from './ui.js';

const SCORES_KEY = 'cv_snake_scores';
const TOP_N = 10;
const SPEED = 160; // 每步毫秒（偏慢）

function loadScores() {
  try { return JSON.parse(localStorage.getItem(SCORES_KEY) || '[]'); } catch { return []; }
}
function saveScores(scores) {
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}

export function mountSnake(container) {
  container.innerHTML = '';

  const GRID = 20;
  const CELL = 20;
  const canvas = document.createElement('canvas');
  canvas.width = GRID * CELL;
  canvas.height = GRID * CELL;
  const ctx = canvas.getContext('2d');

  const hud = el('div', { style: 'margin:10px 0 6px;display:flex;gap:14px;align-items:center;' });
  const scoreEl = el('span');
  const btn = el('button', { onclick: onButton });
  hud.append(scoreEl, btn);

  const hint = el('div', { style: 'font-size:12px;color:var(--muted);' }, '方向键 / WASD 移动，空格暂停');
  const boardTitle = el('div', { style: 'margin-top:12px;font-weight:bold;' }, '历史高分（前十）');
  const board = el('div', { style: 'margin-top:4px;' });
  const nameForm = el('div', { style: 'margin-top:8px;display:none;gap:8px;align-items:center;' });
  const nameInput = el('input', { maxlength: '12', placeholder: '留下昵称' });
  const saveBtn = el('button', { onclick: onSaveName }, '保存成绩');
  nameForm.append(nameInput, saveBtn);

  container.append(canvas, hud, hint, nameForm, boardTitle, board);

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  let snake, dir, nextDir, food, score, paused, timer;
  let scores = loadScores();
  let state = 'idle'; // idle | playing | over

  function reset() {
    snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    paused = false;
    nameForm.style.display = 'none';
    placeFood();
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  }

  function qualifies() {
    if (score <= 0) return false;
    if (scores.length < TOP_N) return true;
    return score > scores[scores.length - 1].score;
  }

  function step() {
    if (state !== 'playing' || paused) return;
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
    state = 'over';
    clearInterval(timer);
    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`游戏结束 · ${score} 分`, canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
    btn.textContent = '再来一局';
    if (qualifies()) {
      nameForm.style.display = 'flex';
      nameInput.focus();
    }
  }

  function draw() {
    ctx.fillStyle = cssVar('--bg') || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state === 'idle') {
      ctx.fillStyle = cssVar('--muted') || '#888';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('点击「开始游戏」', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'left';
      return;
    }

    ctx.fillStyle = '#e07b39';
    ctx.fillRect(food.x * CELL + 1, food.y * CELL + 1, CELL - 2, CELL - 2);

    const headColor = cssVar('--accent') || '#1a5fb4';
    const bodyColor = cssVar('--fg') || '#1a1a1a';
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? headColor : bodyColor;
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function renderBoard() {
    board.innerHTML = '';
    if (!scores.length) {
      board.appendChild(el('div', { style: 'color:var(--muted);font-size:13px' }, '暂无记录'));
      return;
    }
    scores.slice(0, TOP_N).forEach((s, i) => {
      board.appendChild(el('div', { style: 'font-size:13px;margin-bottom:2px' }, `${i + 1}. ${s.name} — ${s.score} 分`));
    });
  }

  function updateHud() {
    scoreEl.textContent = `分数：${score}`;
    if (state === 'playing') btn.textContent = paused ? '继续' : '暂停';
    else if (state === 'over') btn.textContent = '再来一局';
    else btn.textContent = '开始游戏';
  }

  function start() {
    reset();
    state = 'playing';
    clearInterval(timer);
    timer = setInterval(step, SPEED);
    updateHud();
    draw();
  }

  function onButton() {
    if (state === 'idle' || state === 'over') { start(); return; }
    if (state === 'playing') { paused = !paused; updateHud(); }
  }

  function onSaveName() {
    const name = nameInput.value.trim() || '匿名';
    scores.push({ name, score, date: Date.now() });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, TOP_N);
    saveScores(scores);
    nameForm.style.display = 'none';
    nameInput.value = '';
    renderBoard();
  }

  const onKey = (e) => {
    if (state !== 'playing') return;
    const k = e.key.toLowerCase();
    let d = null;
    if (k === 'arrowup' || k === 'w') d = { x: 0, y: -1 };
    else if (k === 'arrowdown' || k === 's') d = { x: 0, y: 1 };
    else if (k === 'arrowleft' || k === 'a') d = { x: -1, y: 0 };
    else if (k === 'arrowright' || k === 'd') d = { x: 1, y: 0 };
    else if (k === ' ') {
      e.preventDefault();
      if (state === 'playing') { paused = !paused; updateHud(); }
      return;
    }
    if (d) {
      e.preventDefault();
      if (!(d.x === -dir.x && d.y === -dir.y)) nextDir = d;
    }
  };
  window.addEventListener('keydown', onKey);

  updateHud();
  draw();
  renderBoard();

  return function stop() {
    clearInterval(timer);
    window.removeEventListener('keydown', onKey);
  };
}
