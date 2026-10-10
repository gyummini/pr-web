import { state, baseUnlocked, collectedCount, TOTAL_EVIDENCE } from './state.js';
import { preloadNotebookFonts } from './preload.js';
import { T, TH } from './text.js';

// 수첩(E7)에 곧 도달할 신호. 폰트는 용량이 커서 진입 시점에 받으면 글씨가 늦게 바뀌므로,
// 기본 증거를 거의 다 모은 시점(세는 증거 전체 − 2)에 미리 백그라운드 요청해둔다.
const NB_FONT_TRIGGER = TOTAL_EVIDENCE - 2;
function maybePreloadNotebookFonts() {
  if (collectedCount() >= NB_FONT_TRIGGER) preloadNotebookFonts();
}

// 닫기 단추의 ✕ — 글자 기호 대신 선 두께가 정해진 그림으로 그린다(글꼴마다 굵기 · 위치가 달랐다). 팝업 · 사진 창 · 알림이 같은 그림을 쓴다
export const CLOSE_ICON =
  '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">' +
  '<path d="M2 2l10 10M12 2L2 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// ---- 수집 카운트 뱃지 ----
// pending: 상태에는 수집됐지만 아직 수집 애니메이션이 도착하지 않은 수.
// 뱃지 표시값 = 세는 증거 수(collectedCount) - pending → 애니메이션 도착 시점에 카운트가 올라가는 연출.
let pending = 0;

function badgeEl() {
  return document.getElementById('badge');
}

export function syncBadge() {
  renderBadge(false);
  maybePreloadNotebookFonts();
}

// 수집은 됐지만 아직 배지에 내려앉지 않은 증거 — 화면이 '모은 흔적'을 내려앉은 뒤에 그리도록(10/10 다1)
export const unlanded = new Set();

export function addPending(n = 1, id) {
  pending += n;
  if (id) unlanded.add(id);
  renderBadge(false);
  maybePreloadNotebookFonts();
}

// 증거 하나가 배지에 내려앉았다. id를 주면 화면에 '모은 흔적'을 남길 수 있게 알린다 —
// 자기소개서 화면이 듣고 문장 끝 체크와 목차 칸을 채운다(10/10 다1). 움직임 줄이기면 비행 없이 바로 여기로 온다
export function landOne(id) {
  pending = Math.max(0, pending - 1);
  if (id) unlanded.delete(id);
  renderBadge(true);
  if (id) document.dispatchEvent(new CustomEvent('pr:landed', { detail: { id } }));
}

function renderBadge(pulse) {
  const el = badgeEl();
  if (!el) return;
  const shown = Math.max(0, collectedCount() - pending);
  el.textContent = `${shown}/${TOTAL_EVIDENCE}`;
  if (pulse) {
    el.classList.remove('pulse');
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add('pulse');
  }
  maybeShowHiddenUnlockToast();
}

// ---- 수집 비행: 그 증거의 쪽지(E번호 도장)가 '포트폴리오' 탭의 배지로 날아간다(10/10 다1) ----
// 전에는 46px 흰 칸이 0.34초에 19px로 줄고 흐려져(불투명도 .4) 무엇이 날았는지 보이지 않았다.
// 0 ~ .2초: 쪽지가 제자리에 선다(opts.grow면 팝업 크기에서 쪽지로 줄어든다) · .2 ~ .45초: 배지로 날아간다 · 내려앉으면 배지가 도장처럼 눌린다.
// 상태는 부른 쪽이 이미 바꿨다 — 이 함수는 보이는 것만 맡는다. 움직임 줄이기 · 가려진 탭이면 날지 않고 바로 내려앉힌다
export const FLY_MS = 450;
export function flyFromRect(rect, onLand, opts = {}) {
  const target = badgeEl();
  const root = document.getElementById('fly-root');
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!target || !root || still || document.hidden || !document.body.animate) {
    if (onLand) onLand();
    return;
  }
  const t = target.getBoundingClientRect();
  const slip = document.createElement('div');
  slip.className = 'fly-slip';
  if (opts.id) {
    const id = document.createElement('span');
    id.className = 'fly-slip-id';
    id.textContent = opts.id;
    slip.appendChild(id);
  }
  const sx = rect.left + rect.width / 2;
  const sy = rect.top + rect.height / 2;
  slip.style.left = `${sx}px`;
  slip.style.top = `${sy}px`;
  root.appendChild(slip);
  const dx = t.left + t.width / 2 - sx;
  const dy = t.top + t.height / 2 - sy;
  const at = (x, y, s, r) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s}) rotate(${r}deg)`;
  slip.animate(
    [
      { transform: at(0, 0, opts.grow ? 1.9 : 0.6, 0), opacity: opts.grow ? 0.2 : 0, offset: 0 },
      { transform: at(0, 0, 1, -5), opacity: 1, offset: 0.44 },
      { transform: at(dx, dy, 0.38, 9), opacity: 1, offset: 0.92 },
      { transform: at(dx, dy, 0.3, 9), opacity: 0, offset: 1 },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }
  );
  let done = false;
  const fin = () => {
    if (done) return;
    done = true;
    slip.remove();
    if (onLand) onLand();
  };
  // 애니메이션 끝 이벤트 대신 타이머로 내려앉힌다 — 가려진 탭에서도 상태와 배지가 어긋나지 않게(DESIGN.md 6절)
  setTimeout(fin, FLY_MS);
}

// ---- 도전과제 스타일 토스트: 화면 구석, 자동 소멸, 클릭 요구 없음 ----
// kind: 'done'(완벽 수집 — 체크) · 'link'(링크 준비 중 — ↗). 표시는 CSS가 그린다(10/09 — 전에는 이모지 🏆 🔗)
export function toast(title, sub = '', kind = 'done') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast';
  const ic = document.createElement('span');
  ic.className = 'toast-icon';
  ic.dataset.kind = kind;
  ic.setAttribute('aria-hidden', 'true');
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

// 엔딩이 시작되거나 수첩이 열리면 할 일을 마친 알림이다 — 닫는다.
// 그대로 두면 엔딩 대사창을 가렸다(10/04 점검: 모바일에서는 대사 줄이 통째로 덮였다).
// 아직 날아가는 증거가 나중에 내려앉아도 다시 띄우지 않게 표시도 남긴다.
export function dismissUnlockToast() {
  if (!baseUnlocked()) return; // 해금 전에 수첩을 먼저 연 사람에게는 알림이 아직 할 일이 있다
  state.hiddenUnlockToastShown = true;
  document.querySelectorAll('.hidden-unlock-toast').forEach((n) => n.remove());
}

// 기본 증거(BASE_EVIDENCE_IDS)를 모두 모은 순간 표시하는 고정 알림. 직접 닫거나 엔딩·수첩으로 들어가기 전까지 유지한다.
function maybeShowHiddenUnlockToast() {
  if (pending > 0 || !baseUnlocked() || state.hiddenUnlockToastShown) return;
  // 보관함에서 해금되고 보너스 칸이 화면에 보이면, 그 칸이 펼쳐지고 도장이 찍히는 것이 알림이다 — 같은 곳으로 가는 알림을 겹쳐 띄우지 않는다
  // (10/10 재채점: 휴대폰에서는 이 고정 알림이 머리말 아래에 남아 제목을 가렸다). 칸이 화면 밖이거나 다른 화면이면 전처럼 알림 하나
  const slot = document.querySelector('#view.view-evidence .hidden-slot-wrap');
  if (slot) {
    const r = slot.getBoundingClientRect();
    const head = document.querySelector('body > header');
    const top = head ? head.getBoundingClientRect().bottom : 0; // 고정 머리말 밑에 숨은 것은 보이지 않는 것으로 친다
    if (r.bottom > top + 24 && r.top < innerHeight) {
      state.hiddenUnlockToastShown = true;
      return;
    }
  }
  const root = document.getElementById('toast-root');
  if (!root) return;

  state.hiddenUnlockToastShown = true;
  // 엔딩 대화를 아직 안 봤다면 그쪽을 거쳐 간다 — 마지막 클루 대사가 여기서만 나오고,
  // E7 수집(7/7)도 엔딩이 끝나는 시점에 일어난다. 곧장 /notebook으로 보내면 둘 다 건너뛴다.
  // 토스트는 닫기 전까지 남아 있으므로 목적지는 누르는 시점에 다시 판단한다.
  // (router.js는 순환 참조라 import하지 않는다 — 내부 링크는 라우터가 <a href>를 가로챈다)
  const dest = () => (state.endingSeen ? '/notebook' : '/ending');
  const destLabel = () => (state.endingSeen ? T('toast.unlock_to_notebook') : T('toast.unlock_to_ending'));

  const el = document.createElement('div');
  el.className = 'toast toast-persistent hidden-unlock-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="toast-icon" data-kind="open" aria-hidden="true"></span>
    <div class="toast-body">
      <div class="toast-title">${TH('toast.unlock_title')}</div>
      <a class="toast-action" href="${dest()}"></a>
    </div>
    <button type="button" class="toast-close" aria-label="${TH('toast.close')}">${CLOSE_ICON}</button>`;

  const close = () => el.remove();
  const action = el.querySelector('.toast-action');
  action.textContent = destLabel();
  el.querySelector('.toast-close').addEventListener('click', close);
  action.addEventListener('click', (e) => {
    // 라우터는 document에서 버블 단계로 받으므로, 여기서 갱신한 href를 그대로 읽는다
    e.currentTarget.setAttribute('href', dest());
    close();
  });
  root.appendChild(el);
}

// ---- 외부 문서 열기: 전부 새 탭. PLACEHOLDER는 안내만 ----
export function openDoc(url) {
  if (!url || String(url).startsWith('PLACEHOLDER')) {
    toast(T('toast.link_pending'), T('toast.link_pending_sub'), 'link');
    return;
  }
  window.open(url, '_blank', 'noopener');
}
