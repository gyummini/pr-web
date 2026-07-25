import { state, TOTAL_EVIDENCE } from './state.js';
import { preloadNotebookFonts } from './preload.js';

// 수첩(E7)에 곧 도달할 신호. 폰트는 용량이 커서 진입 시점에 받으면 글씨가 늦게 바뀌므로,
// 5/7 도달 시점에 미리 백그라운드 요청해둔다.
const NB_FONT_TRIGGER = TOTAL_EVIDENCE - 2;
function maybePreloadNotebookFonts() {
  if (state.collected.size >= NB_FONT_TRIGGER) preloadNotebookFonts();
}

// ---- 수집 카운트 뱃지 ----
// pending: 상태에는 수집됐지만 아직 수집 애니메이션이 도착하지 않은 수.
// 뱃지 표시값 = collected.size - pending → 애니메이션 도착 시점에 카운트가 올라가는 연출.
let pending = 0;

function badgeEl() {
  return document.getElementById('badge');
}

export function syncBadge() {
  renderBadge(false);
  maybePreloadNotebookFonts();
}

export function addPending(n = 1) {
  pending += n;
  renderBadge(false);
  maybePreloadNotebookFonts();
}

export function landOne() {
  pending = Math.max(0, pending - 1);
  renderBadge(true);
}

function renderBadge(pulse) {
  const el = badgeEl();
  if (!el) return;
  const shown = Math.max(0, state.collected.size - pending);
  el.textContent = `${shown}/${TOTAL_EVIDENCE}`;
  if (pulse) {
    el.classList.remove('pulse');
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add('pulse');
  }
}

// ---- 수집 비행 애니메이션: 카드가 '수집된 증거' 탭으로 날아가 흡수 ----
export function flyFromRect(rect, onLand) {
  const target = badgeEl();
  const root = document.getElementById('fly-root');
  if (!target || !root) {
    if (onLand) onLand();
    return;
  }
  const t = target.getBoundingClientRect();
  const g = document.createElement('div');
  g.className = 'fly-ghost';
  g.textContent = '📄';
  const sx = rect.left + rect.width / 2;
  const sy = rect.top + rect.height / 2;
  g.style.left = `${sx}px`;
  g.style.top = `${sy}px`;
  root.appendChild(g);
  const dx = t.left + t.width / 2 - sx;
  const dy = t.top + t.height / 2 - sy;
  // rAF는 백그라운드 탭에서 멈추므로 setTimeout으로 비행 트리거
  setTimeout(() => {
    g.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.15)`;
    g.style.opacity = '0.25';
  }, 30);
  let done = false;
  const fin = () => {
    if (done) return;
    done = true;
    g.remove();
    if (onLand) onLand();
  };
  g.addEventListener('transitionend', fin, { once: true });
  setTimeout(fin, 950); // transitionend 유실 대비
}

// ---- 도전과제 스타일 토스트: 화면 구석, 자동 소멸, 클릭 요구 없음 ----
export function toast(title, sub = '', icon = '🏆') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast';
  const ic = document.createElement('span');
  ic.className = 'toast-icon';
  ic.textContent = icon;
  const body = document.createElement('div');
  body.className = 'toast-body';
  const t = document.createElement('div');
  t.className = 'toast-title';
  t.textContent = title;
  body.appendChild(t);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'toast-sub';
    s.textContent = sub;
    body.appendChild(s);
  }
  el.append(ic, body);
  root.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

// ---- 외부 문서 열기: 전부 새 탭. PLACEHOLDER는 안내만 ----
export function openDoc(url) {
  if (!url || String(url).startsWith('PLACEHOLDER')) {
    toast('링크 준비 중', '이 문서의 외부 링크는 아직 연결되지 않았습니다', '🔗');
    return;
  }
  window.open(url, '_blank', 'noopener');
}
