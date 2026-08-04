import { onRouteChange } from './router.js';

// Vercel Web Analytics 커스텀 이벤트 계측.
// 라우팅 코드는 이 모듈을 모른다 — router.onRouteChange 구독으로만 붙는다.
//
// 기본 페이지뷰(/_vercel/insights/view)는 주입 스크립트가 pushState를 감지해
// 자동 집계하므로 여기서 다시 보내지 않는다.
//
// 값 타입: 문서상 string/number/boolean/null이 허용되지만 전부 문자열로 통일한다.
// 같은 키에 숫자와 문자열이 섞이면(step 1~4 와 '5+') 대시보드 목록이 갈라져 읽기 어려워진다.
// 이름·키·값은 각 255자를 넘길 수 없다.

const DEPTHS = [25, 50, 75, 100];

// 계측 전용 키. 명세서 5의 스토리지 금지는 게임 상태(챕터 열람·증거 수집)에 대한
// 규칙이므로 state.js는 그대로 메모리만 쓴다. 여기에는 진행도만 담고 개인정보는 담지 않는다.
const SS_KEY = 'prweb.nav';

let started = false;

// ---- 현재 페이지뷰의 계측 상태 ----
let path = null;
let visibleMs = 0; // 탭이 보이는 동안만 누적한 체류 시간
let since = 0; // 누적 시작 시각 (0이면 누적 중 아님)
let exitSent = false; // page_exit은 페이지뷰당 1회
const firedDepths = new Set();
let scrollTicking = false;

export function initAnalytics() {
  if (started) return; // 이중 초기화 방지 (모듈 중복 로드·재마운트 대비)
  started = true;

  onRouteChange(({ path: next }) => {
    flushExit(); // 이전 페이지 마감이 먼저
    beginPage(next);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // beforeunload는 신뢰도가 낮아 쓰지 않는다. 탭이 가려지는 시점이 사실상 마지막 기회다.
      flushExit();
    } else {
      resumeTiming();
      // 숨겨진 동안 rAF가 멈춰 스크롤 검사가 걸려 있을 수 있으므로 풀어준다
      scrollTicking = false;
      checkDepth();
    }
  });

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', checkDepth, { passive: true });
}

// ---- 전송 ----
function isDev() {
  const h = location.hostname;
  return (
    h === '' || // file://
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.local')
  );
}

function send(name, data) {
  // 개발 환경에서는 발사하지 않는다. 로컬 검증이 가능하도록 콘솔로만 남긴다.
  if (isDev()) {
    console.debug('[analytics:dev]', name, data);
    return;
  }
  if (typeof window.va !== 'function') return;
  window.va('event', { name, data });
}

// 개인 식별 정보 차단: 쿼리스트링·해시는 절대 싣지 않고 라우트 경로만 보낸다.
function safePath(p) {
  const only = String(p == null ? '/' : p).split('?')[0].split('#')[0];
  return only.slice(0, 255);
}

// ---- 이벤트 1: page_exit (페이지별 체류 시간) ----
function bucket(ms) {
  const s = ms / 1000;
  if (s < 10) return '0-10s';
  if (s < 30) return '10-30s';
  if (s < 60) return '30-60s';
  if (s < 180) return '1-3m';
  return '3m+';
}

function pauseTiming() {
  if (since) {
    visibleMs += Date.now() - since;
    since = 0;
  }
}

function resumeTiming() {
  // 이미 마감된 페이지뷰는 다시 누적하지 않는다 — page_exit이 두 번 나가지 않게 하기 위함.
  if (exitSent || !path) return;
  if (!since && document.visibilityState === 'visible') since = Date.now();
}

function flushExit() {
  if (!path || exitSent) return;
  exitSent = true;
  pauseTiming();
  // 한 번도 보이지 않은 페이지(백그라운드 탭으로 열린 링크 등)는 체류가 아니다.
  // 그대로 보내면 '0-10s'만 쌓여 통계를 흐리고 쿼터만 쓴다.
  if (visibleMs <= 0) return;
  send('page_exit', { path, duration_bucket: bucket(visibleMs) });
}

// ---- 이벤트 2: scroll_depth (어디까지 읽었는가) ----
function onScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    scrollTicking = false;
    checkDepth();
  });
}

function checkDepth() {
  if (!path) return;
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - innerHeight;
  // 스크롤이 없는 화면(수첩 페이저·인트로 등)은 '읽은 깊이'라는 개념이 없다.
  // 여기서 거르지 않으면 진입 즉시 25/50/75/100이 한꺼번에 나가 쿼터만 소모한다.
  if (scrollable <= 0) return;
  const pct = ((scrollY + innerHeight) / doc.scrollHeight) * 100;
  for (const d of DEPTHS) {
    if (pct >= d && !firedDepths.has(d)) {
      firedDepths.add(d); // 페이지당 임계값별 1회
      send('scroll_depth', { path, depth: String(d) });
    }
  }
}

// ---- 이벤트 3: session_progress (세션 내 탐색 깊이) ----
function readNav() {
  try {
    const o = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null');
    if (o && typeof o.count === 'number' && typeof o.entry === 'string') return o;
  } catch {
    /* 사생활 보호 모드 등에서 접근 불가 — 계측만 포기하고 사이트는 그대로 동작 */
  }
  return null;
}

function writeNav(o) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(o));
  } catch {
    /* 무시 */
  }
}

function stepLabel(n) {
  return n >= 5 ? '5+' : String(n);
}

// ---- 페이지뷰 시작 ----
function beginPage(next) {
  path = safePath(next);
  visibleMs = 0;
  since = document.visibilityState === 'visible' ? Date.now() : 0;
  exitSent = false;
  firedDepths.clear();

  const nav = readNav() || { count: 0, entry: path };
  nav.count += 1;
  writeNav(nav);

  send('session_progress', {
    path,
    step: stepLabel(nav.count),
    entry_path: nav.entry,
  });

  // 첫 화면이 이미 스크롤 가능한 상태일 수 있으므로 렌더 직후 1회 확인
  requestAnimationFrame(checkDepth);
}
