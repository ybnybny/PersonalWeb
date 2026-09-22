// 偏好管理：开关灯、背景音乐状态（读写 localStorage）
// 所有偏好键带 cv_ 前缀，避免与同域名下其它项目冲突（§6.5）

const LIGHT_KEY = 'cv_light';
const BGM_KEY = 'cv_bgm';

export function getLight() {
  return localStorage.getItem(LIGHT_KEY) === 'off' ? 'off' : 'on';
}

export function setLight(value) {
  localStorage.setItem(LIGHT_KEY, value === 'off' ? 'off' : 'on');
}

export function getBgm() {
  const def = { on: true, trackIndex: 0, currentTime: 0 };
  try {
    const raw = localStorage.getItem(BGM_KEY);
    if (!raw) return def;
    const obj = JSON.parse(raw);
    return { ...def, ...obj };
  } catch {
    return def;
  }
}

export function setBgm(obj) {
  localStorage.setItem(BGM_KEY, JSON.stringify(obj));
}

// 白天 / 夜晚（夜晚 = 当地 22:00–07:00，§5.5）
export function isNight(now = new Date()) {
  const h = now.getHours();
  return h >= 22 || h < 7;
}
